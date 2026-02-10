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
declare class EmotosApiClient {
    private request;
    login(email: string, password: string): Promise<ApiResponse<{
        user: User;
        org: Organization;
        sessionToken: string;
    }>>;
    signup(data: {
        email: string;
        password: string;
        name: string;
        role: string;
        orgName?: string;
    }): Promise<ApiResponse<{
        user: User;
        org: Organization;
        sessionToken: string;
    }>>;
    verify(token: string): Promise<ApiResponse<{
        user: User;
        org: Organization;
        token: string;
    }>>;
    logout(): Promise<ApiResponse<{
        success: boolean;
    }>>;
    me(): Promise<ApiResponse<{
        user: User;
        org: Organization;
    }>>;
    createAgent(data: {
        name: string;
        description?: string;
        environment?: string;
        policyId?: string;
    }): Promise<ApiResponse<Agent>>;
    listAgents(params?: {
        environment?: string;
        status?: string;
        name?: string;
        limit?: number;
        offset?: number;
    }): Promise<ApiResponse<PaginatedResult<Agent>>>;
    getAgent(agentId: string): Promise<ApiResponse<Agent>>;
    resolveAgent(nameOrId: string): Promise<string>;
    resolveWorkspace(nameOrId: string): Promise<string>;
    resolvePolicy(nameOrId: string): Promise<string>;
    issueToken(agentId: string, ttlSeconds?: number): Promise<ApiResponse<TokenResult>>;
    revokeAgent(agentId: string): Promise<ApiResponse<{
        success: boolean;
        revokedAt: string;
    }>>;
    rotateCredentials(agentId: string): Promise<ApiResponse<TokenResult & {
        apiKey: string;
    }>>;
    createPolicy(data: {
        name: string;
        description?: string;
        content: string;
    }): Promise<ApiResponse<Policy>>;
    listPolicies(): Promise<ApiResponse<{
        policies: Policy[];
    }>>;
    getPolicy(policyId: string): Promise<ApiResponse<Policy>>;
    updatePolicy(policyId: string, content: string): Promise<ApiResponse<Policy>>;
    validatePolicy(content: string): Promise<ApiResponse<{
        valid: boolean;
        errors?: string[];
    }>>;
    activatePolicy(policyId: string): Promise<ApiResponse<Policy>>;
    deactivatePolicy(policyId: string): Promise<ApiResponse<Policy>>;
    queryAuditEvents(params?: {
        agentId?: string;
        eventType?: string;
        startTime?: string;
        endTime?: string;
        limit?: number;
    }): Promise<ApiResponse<PaginatedResult<AuditEvent>>>;
    getAuditEvent(eventId: string): Promise<ApiResponse<AuditEvent>>;
    listThreats(params?: {
        agentId?: string;
        severity?: string;
        status?: string;
        limit?: number;
    }): Promise<ApiResponse<PaginatedResult<Threat>>>;
    resolveThreat(threatId: string): Promise<ApiResponse<Threat>>;
    createWebhook(data: {
        url: string;
        events: string[];
        secret?: string;
    }): Promise<ApiResponse<Webhook>>;
    listWebhooks(): Promise<ApiResponse<{
        webhooks: Webhook[];
    }>>;
    deleteWebhook(webhookId: string): Promise<ApiResponse<{
        success: boolean;
    }>>;
    testWebhook(webhookId: string): Promise<ApiResponse<{
        success: boolean;
        statusCode?: number;
        error?: string;
    }>>;
    getOrganization(): Promise<ApiResponse<Organization>>;
    updateOrganization(data: {
        name?: string;
        settings?: Record<string, unknown>;
    }): Promise<ApiResponse<Organization>>;
    rotateOrgApiKey(): Promise<ApiResponse<{
        apiKey: string;
        id: string;
    }>>;
    getMetrics(): Promise<ApiResponse<{
        totalAgents: number;
        activeAgents: number;
        totalRequests: number;
        blockedRequests: number;
        threatCount: number;
        avgReputation: number;
    }>>;
    createWorkspace(data: {
        name: string;
        purpose?: string;
        mode?: string;
        maxParticipants?: number;
        expiresAt?: string;
    }): Promise<ApiResponse<any>>;
    listWorkspaces(params?: {
        status?: string;
        name?: string;
    }): Promise<ApiResponse<{
        items: any[];
    }>>;
    getWorkspace(workspaceId: string): Promise<ApiResponse<any>>;
    workspaceInvite(workspaceId: string, data: {
        agentName: string;
        expires?: string;
        email?: string;
        maxUses?: number;
    }): Promise<ApiResponse<{
        inviteToken: string;
        joinUrl?: string;
        maxUses?: number | string;
    }>>;
    workspaceJoin(workspaceId: string, data: {
        agentId: string;
        inviteToken: string;
    }): Promise<ApiResponse<any>>;
    workspaceLeave(workspaceId: string, data: {
        agentId: string;
    }): Promise<ApiResponse<any>>;
    closeWorkspace(workspaceId: string): Promise<ApiResponse<{
        success: boolean;
    }>>;
    workspacePostMessage(workspaceId: string, data: {
        senderAgentId: string;
        type?: string;
        content: string;
    }): Promise<ApiResponse<any>>;
    workspaceMessages(workspaceId: string, params?: {
        after?: string;
        limit?: number;
    }): Promise<ApiResponse<{
        items: any[];
        nextCursor?: string;
    }>>;
    workspacePresence(workspaceId: string): Promise<ApiResponse<{
        participants: any[];
    }>>;
    workspaceStream(workspaceId: string): Promise<ReadableStreamDefaultReader<Uint8Array> | null>;
    generatePolicy(data: {
        prompt: string;
        workspaceId?: string;
        mode?: string;
        existingPolicyId?: string;
    }): Promise<ApiResponse<any>>;
    streamEvents(path: string): Promise<ReadableStreamDefaultReader<Uint8Array> | null>;
}
export declare const api: EmotosApiClient;
export {};
//# sourceMappingURL=api.d.ts.map