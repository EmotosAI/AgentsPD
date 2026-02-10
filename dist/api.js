import { getApiUrl, getAuthHeader, isAuthenticated } from './config.js';
class EmotosApiClient {
    async request(method, path, body, requireAuth = true) {
        if (requireAuth && !isAuthenticated()) {
            return {
                error: { message: 'Not authenticated. Run `emotos auth login` first.', code: 'NOT_AUTHENTICATED' },
                status: 401,
            };
        }
        const url = `${getApiUrl()}/v1${path}`;
        const headers = {
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
        }
        catch (error) {
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
    async login(email, password) {
        return this.request('POST', '/auth/login', { email, password }, false);
    }
    async signup(data) {
        return this.request('POST', '/auth/signup', data, false);
    }
    async verify(token) {
        return this.request('POST', '/auth/verify', { token }, false);
    }
    async logout() {
        return this.request('POST', '/auth/logout');
    }
    async me() {
        return this.request('GET', '/auth/me');
    }
    // Agent endpoints
    async createAgent(data) {
        return this.request('POST', '/agents', data);
    }
    async listAgents(params) {
        const query = new URLSearchParams();
        if (params?.environment)
            query.set('environment', params.environment);
        if (params?.status)
            query.set('status', params.status);
        if (params?.name)
            query.set('name', params.name);
        if (params?.limit)
            query.set('limit', String(params.limit));
        if (params?.offset)
            query.set('offset', String(params.offset));
        const queryStr = query.toString();
        return this.request('GET', `/agents${queryStr ? `?${queryStr}` : ''}`);
    }
    async getAgent(agentId) {
        return this.request('GET', `/agents/${agentId}`);
    }
    // ── Name-based resolvers ─────────────────────────────────────────────
    // These let CLI commands accept either a UUID or a human-readable name.
    async resolveAgent(nameOrId) {
        if (isUuid(nameOrId))
            return nameOrId;
        const result = await this.listAgents({ name: nameOrId });
        if (result.data?.items.length === 1)
            return result.data.items[0].id;
        if (result.data && result.data.items.length > 1)
            throw new Error(`Multiple agents named "${nameOrId}". Use the ID instead.`);
        throw new Error(`Agent "${nameOrId}" not found.`);
    }
    async resolveWorkspace(nameOrId) {
        if (isUuid(nameOrId))
            return nameOrId;
        const result = await this.listWorkspaces({ name: nameOrId });
        if (result.data?.items) {
            const matches = result.data.items.filter((w) => w.name === nameOrId);
            if (matches.length === 1)
                return matches[0].id;
            if (matches.length > 1)
                throw new Error(`Multiple workspaces named "${nameOrId}". Use the ID instead.`);
        }
        throw new Error(`Workspace "${nameOrId}" not found.`);
    }
    async resolvePolicy(nameOrId) {
        if (isUuid(nameOrId))
            return nameOrId;
        const result = await this.listPolicies();
        if (result.data?.policies) {
            const matches = result.data.policies.filter((p) => p.name === nameOrId);
            if (matches.length === 1)
                return matches[0].id;
            if (matches.length > 1)
                throw new Error(`Multiple policies named "${nameOrId}". Use the ID instead.`);
        }
        throw new Error(`Policy "${nameOrId}" not found.`);
    }
    async issueToken(agentId, ttlSeconds) {
        return this.request('POST', `/agents/${agentId}/token`, { ttlSeconds });
    }
    async revokeAgent(agentId) {
        return this.request('POST', `/agents/${agentId}/revoke`);
    }
    async rotateCredentials(agentId) {
        return this.request('POST', `/agents/${agentId}/rotate`);
    }
    // Policy endpoints
    async createPolicy(data) {
        return this.request('POST', '/policies', data);
    }
    async listPolicies() {
        return this.request('GET', '/policies');
    }
    async getPolicy(policyId) {
        return this.request('GET', `/policies/${policyId}`);
    }
    async updatePolicy(policyId, content) {
        return this.request('PUT', `/policies/${policyId}`, { content });
    }
    async validatePolicy(content) {
        return this.request('POST', '/policies/validate', { content });
    }
    async activatePolicy(policyId) {
        return this.request('POST', `/policies/${policyId}/activate`);
    }
    async deactivatePolicy(policyId) {
        return this.request('POST', `/policies/${policyId}/deactivate`);
    }
    // Audit endpoints
    async queryAuditEvents(params) {
        const query = new URLSearchParams();
        if (params?.agentId)
            query.set('agentId', params.agentId);
        if (params?.eventType)
            query.set('eventType', params.eventType);
        if (params?.startTime)
            query.set('startTime', params.startTime);
        if (params?.endTime)
            query.set('endTime', params.endTime);
        if (params?.limit)
            query.set('limit', String(params.limit));
        const queryStr = query.toString();
        return this.request('GET', `/audit/events${queryStr ? `?${queryStr}` : ''}`);
    }
    async getAuditEvent(eventId) {
        return this.request('GET', `/audit/events/${eventId}`);
    }
    // Threat endpoints
    async listThreats(params) {
        const query = new URLSearchParams();
        if (params?.agentId)
            query.set('agentId', params.agentId);
        if (params?.severity)
            query.set('severity', params.severity);
        if (params?.status)
            query.set('status', params.status);
        if (params?.limit)
            query.set('limit', String(params.limit));
        const queryStr = query.toString();
        return this.request('GET', `/threats${queryStr ? `?${queryStr}` : ''}`);
    }
    async resolveThreat(threatId) {
        return this.request('POST', `/threats/${threatId}/resolve`);
    }
    // Webhook endpoints
    async createWebhook(data) {
        return this.request('POST', '/webhooks', data);
    }
    async listWebhooks() {
        return this.request('GET', '/webhooks');
    }
    async deleteWebhook(webhookId) {
        return this.request('DELETE', `/webhooks/${webhookId}`);
    }
    async testWebhook(webhookId) {
        return this.request('POST', `/webhooks/${webhookId}/test`);
    }
    // Organization endpoints
    async getOrganization() {
        return this.request('GET', '/org');
    }
    async updateOrganization(data) {
        return this.request('PUT', '/org', data);
    }
    async rotateOrgApiKey() {
        return this.request('POST', '/org/rotate-key');
    }
    // Metrics endpoints
    async getMetrics() {
        return this.request('GET', '/metrics');
    }
    // Workspace endpoints
    async createWorkspace(data) {
        const result = await this.request('POST', '/workspaces', data);
        // API wraps response in { workspace: {...} } — unwrap for consistency
        if (result.data?.workspace) {
            result.data = result.data.workspace;
        }
        return result;
    }
    async listWorkspaces(params) {
        const query = new URLSearchParams();
        if (params?.status)
            query.set('status', params.status);
        if (params?.name)
            query.set('name', params.name);
        const queryStr = query.toString();
        const result = await this.request('GET', `/workspaces${queryStr ? `?${queryStr}` : ''}`);
        // API returns { workspaces: [...] } — normalize to { items: [...] }
        if (result.data && result.data.workspaces && !result.data.items) {
            result.data.items = result.data.workspaces;
            delete result.data.workspaces;
        }
        return result;
    }
    async getWorkspace(workspaceId) {
        return this.request('GET', `/workspaces/${workspaceId}`);
    }
    async workspaceInvite(workspaceId, data) {
        return this.request('POST', `/workspaces/${workspaceId}/invite`, data);
    }
    async workspaceJoin(workspaceId, data) {
        return this.request('POST', `/workspaces/${workspaceId}/join`, data);
    }
    async workspaceLeave(workspaceId, data) {
        return this.request('POST', `/workspaces/${workspaceId}/leave`, data);
    }
    async closeWorkspace(workspaceId) {
        return this.request('DELETE', `/workspaces/${workspaceId}`);
    }
    async workspacePostMessage(workspaceId, data) {
        const result = await this.request('POST', `/workspaces/${workspaceId}/messages`, data);
        // API wraps response in { message: {...} } — unwrap for consistency
        if (result.data?.message) {
            result.data = result.data.message;
        }
        return result;
    }
    async workspaceMessages(workspaceId, params) {
        const query = new URLSearchParams();
        if (params?.after)
            query.set('after', params.after);
        if (params?.limit)
            query.set('limit', String(params.limit));
        const queryStr = query.toString();
        const result = await this.request('GET', `/workspaces/${workspaceId}/messages${queryStr ? `?${queryStr}` : ''}`);
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
    async workspacePresence(workspaceId) {
        return this.request('GET', `/workspaces/${workspaceId}/presence`);
    }
    async workspaceStream(workspaceId) {
        if (!isAuthenticated())
            return null;
        const url = `${getApiUrl()}/v1/workspaces/${workspaceId}/stream`;
        try {
            const response = await fetch(url, {
                headers: { ...getAuthHeader(), Accept: 'text/event-stream' },
            });
            return response.body?.getReader() ?? null;
        }
        catch {
            return null;
        }
    }
    async generatePolicy(data) {
        return this.request('POST', '/policies/generate', data);
    }
    // ── SSE streaming ────────────────────────────────────────────────────
    async streamEvents(path) {
        if (!isAuthenticated())
            return null;
        const url = `${getApiUrl()}/v1${path}`;
        try {
            const response = await fetch(url, {
                headers: { ...getAuthHeader(), Accept: 'text/event-stream' },
            });
            return response.body?.getReader() ?? null;
        }
        catch {
            return null;
        }
    }
}
function isUuid(str) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}
export const api = new EmotosApiClient();
