/**
 * Lightweight HTTP client for the OpenClaw Gateway API.
 *
 * OpenClaw exposes a single HTTP endpoint that multiplexes tool calls:
 *   - POST /tools/invoke   — invoke any registered tool
 *
 * Available tools include:
 *   - sessions_list        — list all active sessions
 *   - sessions_history     — get transcript for a session
 *   - message (send)       — send a message to a channel
 *
 * All endpoints share the same auth: Bearer token via `gateway.auth.token`.
 */
export interface OpenClawToolResult<T = unknown> {
    ok: boolean;
    result?: T;
    error?: {
        type: string;
        message: string;
    };
}
export interface OpenClawSession {
    key: string;
    sessionId?: string;
    kind?: string;
    channel?: string;
    displayName?: string;
    model?: string;
    updatedAt?: number;
    agentId?: string;
    summary?: string;
    createdAt?: string;
    lastActivity?: string;
}
export interface OpenClawConnectionStatus {
    connected: boolean;
    latencyMs: number;
    error?: string;
    sessions?: OpenClawSession[];
}
export interface OpenClawHookResponse {
    ok: boolean;
    error?: string;
}
/**
 * Test connectivity to an OpenClaw Gateway by invoking `sessions_list`.
 */
export declare function testConnection(gatewayUrl: string, token: string): Promise<OpenClawConnectionStatus>;
/**
 * List active sessions on the OpenClaw Gateway.
 */
export declare function listSessions(gatewayUrl: string, token: string): Promise<OpenClawSession[]>;
/**
 * Fetch the transcript / history for a specific OpenClaw session.
 */
export declare function getSessionHistory(gatewayUrl: string, token: string, sessionKey: string): Promise<unknown[]>;
/**
 * Send a message through the OpenClaw Gateway using the `message` tool.
 *
 * The Gateway exposes tool invocation via `POST /tools/invoke`.  The
 * `message` tool with `action: "send"` delivers a message to the
 * specified channel (slack, telegram, whatsapp, etc.).
 *
 * The `message` tool always requires a `to` target.  When none is
 * explicitly provided we auto-resolve it from the most recently active
 * session that matches the requested channel.
 */
export declare function invokeHook(gatewayUrl: string, token: string, options: {
    message: string;
    name?: string;
    sessionKey?: string;
    deliver?: boolean;
    channel?: string;
    to?: string;
}): Promise<OpenClawHookResponse>;
/**
 * Wake the OpenClaw main session by sending a system-level message
 * through the Gateway's `message` tool.
 */
export declare function wakeGateway(gatewayUrl: string, token: string, text: string): Promise<OpenClawHookResponse>;
//# sourceMappingURL=openclaw-api.d.ts.map