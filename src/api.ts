import { getApiUrl, getAuthHeader, isAuthenticated } from './config.js';

export interface ApiResponse<T> {
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
  status: number;
}

export interface Agent {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  status: 'active' | 'suspended' | 'revoked';
  environment: 'development' | 'staging' | 'production';
  reputationScore: number;
  policyId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export interface Policy {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  content: string;
  version: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AuditEvent {
  id: string;
  orgId: string;
  agentId: string;
  eventType: string;
  requestData?: Record<string, unknown>;
  responseData?: Record<string, unknown>;
  timestamp: string;
  signature?: string;
}

export interface Threat {
  id: string;
  orgId: string;
  agentId: string;
  eventId: string;
  threatType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'detected' | 'blocked' | 'escalated' | 'resolved';
  details: Record<string, unknown>;
  createdAt: string;
  resolvedAt?: string;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  createdAt: string;
}

export interface TokenResult {
  token: string;
  expiresAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  cursor?: string;
}

export interface Organization {
  id: string;
  name: string;
  tier: 'free' | 'pro' | 'enterprise';
  settings: Record<string, unknown>;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'provider' | 'consumer' | 'admin';
  createdAt: string;
}

class EmotosApiClient {
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    requireAuth = true
  ): Promise<ApiResponse<T>> {
    if (requireAuth && !isAuthenticated()) {
      return {
        error: { message: 'Not authenticated. Run `emotos auth login` first.', code: 'NOT_AUTHENTICATED' },
        status: 401,
      };
    }

    const url = `${getApiUrl()}/v1${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          error: {
            message: data.error || data.message || `Request failed with status ${response.status}`,
            code: data.code,
          },
          status: response.status,
        };
      }

      return { data, status: response.status };
    } catch (error) {
      return {
        error: {
          message: error instanceof Error ? error.message : 'Network error',
          code: 'NETWORK_ERROR',
        },
        status: 0,
      };
    }
  }

  // Auth endpoints
  async login(email: string, password: string): Promise<ApiResponse<{ user: User; org: Organization; sessionToken: string }>> {
    return this.request('POST', '/auth/login', { email, password }, false);
  }

  async signup(data: { email: string; password: string; name: string; role: string; orgName?: string }): Promise<ApiResponse<{ user: User; org: Organization; sessionToken: string }>> {
    return this.request('POST', '/auth/signup', data, false);
  }

  async verify(token: string): Promise<ApiResponse<{ user: User; org: Organization; token: string }>> {
    return this.request('POST', '/auth/verify', { token }, false);
  }

  async logout(): Promise<ApiResponse<{ success: boolean }>> {
    return this.request('POST', '/auth/logout');
  }

  async me(): Promise<ApiResponse<{ user: User; org: Organization }>> {
    return this.request('GET', '/auth/me');
  }

  // Agent endpoints
  async createAgent(data: {
    name: string;
    description?: string;
    environment?: string;
    policyId?: string;
  }): Promise<ApiResponse<Agent>> {
    return this.request('POST', '/agents', data);
  }

  async listAgents(params?: {
    environment?: string;
    status?: string;
    name?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<PaginatedResult<Agent>>> {
    const query = new URLSearchParams();
    if (params?.environment) query.set('environment', params.environment);
    if (params?.status) query.set('status', params.status);
    if (params?.name) query.set('name', params.name);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const queryStr = query.toString();
    return this.request('GET', `/agents${queryStr ? `?${queryStr}` : ''}`);
  }

  async getAgent(agentId: string): Promise<ApiResponse<Agent>> {
    return this.request('GET', `/agents/${agentId}`);
  }

  // ── Name-based resolvers ─────────────────────────────────────────────
  // These let CLI commands accept either a UUID or a human-readable name.

  async resolveAgent(nameOrId: string): Promise<string> {
    if (isUuid(nameOrId)) return nameOrId;
    const result = await this.listAgents({ name: nameOrId });
    if (result.data?.items.length === 1) return result.data.items[0].id;
    if (result.data && result.data.items.length > 1) throw new Error(`Multiple agents named "${nameOrId}". Use the ID instead.`);
    throw new Error(`Agent "${nameOrId}" not found.`);
  }

  async resolveWorkspace(nameOrId: string): Promise<string> {
    if (isUuid(nameOrId)) return nameOrId;
    const result = await this.listWorkspaces({ name: nameOrId });
    if (result.data?.items) {
      const matches = result.data.items.filter((w: any) => w.name === nameOrId);
      if (matches.length === 1) return matches[0].id;
      if (matches.length > 1) throw new Error(`Multiple workspaces named "${nameOrId}". Use the ID instead.`);
    }
    throw new Error(`Workspace "${nameOrId}" not found.`);
  }

  async resolvePolicy(nameOrId: string): Promise<string> {
    if (isUuid(nameOrId)) return nameOrId;
    const result = await this.listPolicies();
    if (result.data?.policies) {
      const matches = result.data.policies.filter((p: any) => p.name === nameOrId);
      if (matches.length === 1) return matches[0].id;
      if (matches.length > 1) throw new Error(`Multiple policies named "${nameOrId}". Use the ID instead.`);
    }
    throw new Error(`Policy "${nameOrId}" not found.`);
  }

  async issueToken(agentId: string, ttlSeconds?: number): Promise<ApiResponse<TokenResult>> {
    return this.request('POST', `/agents/${agentId}/token`, { ttlSeconds });
  }

  async revokeAgent(agentId: string): Promise<ApiResponse<{ success: boolean; revokedAt: string }>> {
    return this.request('POST', `/agents/${agentId}/revoke`);
  }

  async rotateCredentials(agentId: string): Promise<ApiResponse<TokenResult & { apiKey: string }>> {
    return this.request('POST', `/agents/${agentId}/rotate`);
  }

  // Policy endpoints
  async createPolicy(data: {
    name: string;
    description?: string;
    content: string;
  }): Promise<ApiResponse<Policy>> {
    return this.request('POST', '/policies', data);
  }

  async listPolicies(): Promise<ApiResponse<{ policies: Policy[] }>> {
    return this.request('GET', '/policies');
  }

  async getPolicy(policyId: string): Promise<ApiResponse<Policy>> {
    return this.request('GET', `/policies/${policyId}`);
  }

  async updatePolicy(policyId: string, content: string): Promise<ApiResponse<Policy>> {
    return this.request('PUT', `/policies/${policyId}`, { content });
  }

  async validatePolicy(content: string): Promise<ApiResponse<{ valid: boolean; errors?: string[] }>> {
    return this.request('POST', '/policies/validate', { content });
  }

  async activatePolicy(policyId: string): Promise<ApiResponse<Policy>> {
    return this.request('POST', `/policies/${policyId}/activate`);
  }

  async deactivatePolicy(policyId: string): Promise<ApiResponse<Policy>> {
    return this.request('POST', `/policies/${policyId}/deactivate`);
  }

  // Audit endpoints
  async queryAuditEvents(params?: {
    agentId?: string;
    eventType?: string;
    startTime?: string;
    endTime?: string;
    limit?: number;
  }): Promise<ApiResponse<PaginatedResult<AuditEvent>>> {
    const query = new URLSearchParams();
    if (params?.agentId) query.set('agentId', params.agentId);
    if (params?.eventType) query.set('eventType', params.eventType);
    if (params?.startTime) query.set('startTime', params.startTime);
    if (params?.endTime) query.set('endTime', params.endTime);
    if (params?.limit) query.set('limit', String(params.limit));
    const queryStr = query.toString();
    return this.request('GET', `/audit/events${queryStr ? `?${queryStr}` : ''}`);
  }

  async getAuditEvent(eventId: string): Promise<ApiResponse<AuditEvent>> {
    return this.request('GET', `/audit/events/${eventId}`);
  }

  // Threat endpoints
  async listThreats(params?: {
    agentId?: string;
    severity?: string;
    status?: string;
    limit?: number;
  }): Promise<ApiResponse<PaginatedResult<Threat>>> {
    const query = new URLSearchParams();
    if (params?.agentId) query.set('agentId', params.agentId);
    if (params?.severity) query.set('severity', params.severity);
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', String(params.limit));
    const queryStr = query.toString();
    return this.request('GET', `/threats${queryStr ? `?${queryStr}` : ''}`);
  }

  async resolveThreat(threatId: string): Promise<ApiResponse<Threat>> {
    return this.request('POST', `/threats/${threatId}/resolve`);
  }

  // Webhook endpoints
  async createWebhook(data: {
    url: string;
    events: string[];
    secret?: string;
  }): Promise<ApiResponse<Webhook>> {
    return this.request('POST', '/webhooks', data);
  }

  async listWebhooks(): Promise<ApiResponse<{ webhooks: Webhook[] }>> {
    return this.request('GET', '/webhooks');
  }

  async deleteWebhook(webhookId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request('DELETE', `/webhooks/${webhookId}`);
  }

  async testWebhook(webhookId: string): Promise<ApiResponse<{ success: boolean; statusCode?: number; error?: string }>> {
    return this.request('POST', `/webhooks/${webhookId}/test`);
  }

  // Organization endpoints
  async getOrganization(): Promise<ApiResponse<Organization>> {
    return this.request('GET', '/org');
  }

  async updateOrganization(data: { name?: string; settings?: Record<string, unknown> }): Promise<ApiResponse<Organization>> {
    return this.request('PUT', '/org', data);
  }

  async rotateOrgApiKey(): Promise<ApiResponse<{ apiKey: string; id: string }>> {
    return this.request('POST', '/org/rotate-key');
  }

  // Metrics endpoints
  async getMetrics(): Promise<ApiResponse<{
    totalAgents: number;
    activeAgents: number;
    totalRequests: number;
    blockedRequests: number;
    threatCount: number;
    avgReputation: number;
  }>> {
    return this.request('GET', '/metrics');
  }

  // Workspace endpoints
  async createWorkspace(data: {
    name: string;
    purpose?: string;
    mode?: string;
    maxParticipants?: number;
    expiresAt?: string;
  }): Promise<ApiResponse<any>> {
    const result = await this.request<any>('POST', '/workspaces', data);
    // API wraps response in { workspace: {...} } — unwrap for consistency
    if (result.data?.workspace) {
      result.data = result.data.workspace;
    }
    return result;
  }

  async listWorkspaces(params?: { status?: string; name?: string }): Promise<ApiResponse<{ items: any[] }>> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.name) query.set('name', params.name);
    const queryStr = query.toString();
    const result = await this.request<any>('GET', `/workspaces${queryStr ? `?${queryStr}` : ''}`);
    // API returns { workspaces: [...] } — normalize to { items: [...] }
    if (result.data && result.data.workspaces && !result.data.items) {
      result.data.items = result.data.workspaces;
      delete result.data.workspaces;
    }
    return result;
  }

  async getWorkspace(workspaceId: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/workspaces/${workspaceId}`);
  }

  async workspaceInvite(workspaceId: string, data: { agentName: string; expires?: string; email?: string; maxUses?: number }): Promise<ApiResponse<{ inviteToken: string; joinUrl?: string; maxUses?: number | string }>> {
    return this.request('POST', `/workspaces/${workspaceId}/invite`, data);
  }

  async workspaceJoin(workspaceId: string, data: { agentId: string; inviteToken: string }): Promise<ApiResponse<any>> {
    return this.request('POST', `/workspaces/${workspaceId}/join`, data);
  }

  async workspaceLeave(workspaceId: string, data: { agentId: string }): Promise<ApiResponse<any>> {
    return this.request('POST', `/workspaces/${workspaceId}/leave`, data);
  }

  async closeWorkspace(workspaceId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request('DELETE', `/workspaces/${workspaceId}`);
  }

  async workspacePostMessage(workspaceId: string, data: {
    senderAgentId: string;
    type?: string;
    content: string;
  }): Promise<ApiResponse<any>> {
    const result = await this.request<any>('POST', `/workspaces/${workspaceId}/messages`, data);
    // API wraps response in { message: {...} } — unwrap for consistency
    if (result.data?.message) {
      result.data = result.data.message;
    }
    return result;
  }

  async workspaceMessages(workspaceId: string, params?: { after?: string; limit?: number }): Promise<ApiResponse<{ items: any[]; nextCursor?: string }>> {
    const query = new URLSearchParams();
    if (params?.after) query.set('after', params.after);
    if (params?.limit) query.set('limit', String(params.limit));
    const queryStr = query.toString();
    const result = await this.request<any>('GET', `/workspaces/${workspaceId}/messages${queryStr ? `?${queryStr}` : ''}`);
    // API returns { messages: [...], cursor } — normalize to { items: [...], nextCursor }
    if (result.data && result.data.messages && !result.data.items) {
      result.data.items = result.data.messages;
      delete result.data.messages;
    }
    if (result.data && result.data.cursor !== undefined && result.data.nextCursor === undefined) {
      result.data.nextCursor = result.data.cursor;
      delete result.data.cursor;
    }
    return result;
  }

  async workspacePresence(workspaceId: string): Promise<ApiResponse<{ participants: any[] }>> {
    return this.request('GET', `/workspaces/${workspaceId}/presence`);
  }

  async workspaceStream(workspaceId: string): Promise<ReadableStreamDefaultReader<Uint8Array> | null> {
    if (!isAuthenticated()) return null;
    const url = `${getApiUrl()}/v1/workspaces/${workspaceId}/stream`;
    try {
      const response = await fetch(url, {
        headers: { ...getAuthHeader(), Accept: 'text/event-stream' },
      });
      return response.body?.getReader() ?? null;
    } catch {
      return null;
    }
  }

  async generatePolicy(data: {
    prompt: string;
    workspaceId?: string;
    mode?: string;
    existingPolicyId?: string;
  }): Promise<ApiResponse<any>> {
    return this.request('POST', '/policies/generate', data);
  }

  // ── SSE streaming ────────────────────────────────────────────────────
  async streamEvents(path: string): Promise<ReadableStreamDefaultReader<Uint8Array> | null> {
    if (!isAuthenticated()) return null;
    const url = `${getApiUrl()}/v1${path}`;
    try {
      const response = await fetch(url, {
        headers: { ...getAuthHeader(), Accept: 'text/event-stream' },
      });
      return response.body?.getReader() ?? null;
    } catch {
      return null;
    }
  }
}

function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export const api = new EmotosApiClient();
