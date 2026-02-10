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
function authHeaders(token) {
    return {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
    };
}
/**
 * Extract sessions from the OpenClaw Gateway tool-invoke response.
 *
 * The gateway wraps sessions_list output as:
 *   { ok, result: { details: { sessions: [...] } } }
 *
 * But older / simpler gateways may return a flat array at `result` directly.
 */
function extractSessions(data) {
    const result = data.result;
    if (Array.isArray(result))
        return result;
    if (result && typeof result === "object") {
        const payload = result;
        if (Array.isArray(payload.details?.sessions)) {
            return payload.details.sessions;
        }
    }
    return [];
}
/**
 * Test connectivity to an OpenClaw Gateway by invoking `sessions_list`.
 */
export async function testConnection(gatewayUrl, token) {
    const start = Date.now();
    try {
        const response = await fetch(`${gatewayUrl}/tools/invoke`, {
            method: "POST",
            headers: authHeaders(token),
            body: JSON.stringify({ tool: "sessions_list", action: "json", args: {} }),
        });
        const latencyMs = Date.now() - start;
        if (response.status === 401) {
            return {
                connected: false,
                latencyMs,
                error: "Authentication failed — check your Gateway token",
            };
        }
        if (response.status === 404) {
            // Tools Invoke API might not recognize sessions_list, but the endpoint responded
            return {
                connected: true,
                latencyMs,
                error: "Gateway reachable but sessions_list tool not available",
            };
        }
        if (!response.ok) {
            return {
                connected: false,
                latencyMs,
                error: `Gateway returned HTTP ${response.status}`,
            };
        }
        const data = (await response.json());
        const sessions = extractSessions(data);
        return {
            connected: true,
            latencyMs,
            sessions: sessions.length > 0 ? sessions : undefined,
        };
    }
    catch (err) {
        const latencyMs = Date.now() - start;
        const message = err instanceof Error ? err.message : String(err);
        return {
            connected: false,
            latencyMs,
            error: `Cannot reach Gateway: ${message}`,
        };
    }
}
/**
 * List active sessions on the OpenClaw Gateway.
 */
export async function listSessions(gatewayUrl, token) {
    const response = await fetch(`${gatewayUrl}/tools/invoke`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ tool: "sessions_list", action: "json", args: {} }),
    });
    if (!response.ok) {
        throw new Error(`Failed to list sessions: HTTP ${response.status}`);
    }
    const data = (await response.json());
    if (!data.ok) {
        throw new Error(data.error?.message || "Failed to list sessions");
    }
    return extractSessions(data);
}
/**
 * Fetch the transcript / history for a specific OpenClaw session.
 */
export async function getSessionHistory(gatewayUrl, token, sessionKey) {
    const response = await fetch(`${gatewayUrl}/tools/invoke`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
            tool: "sessions_history",
            action: "json",
            args: { sessionKey },
        }),
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch session history: HTTP ${response.status}`);
    }
    const data = (await response.json());
    if (!data.ok) {
        throw new Error(data.error?.message || "Failed to fetch session history");
    }
    // History may come nested in result.details.messages or result directly.
    const result = data.result;
    if (Array.isArray(result))
        return result;
    if (result && typeof result === "object") {
        const details = result.details;
        if (details && Array.isArray(details.messages))
            return details.messages;
        if (details && Array.isArray(details.history))
            return details.history;
    }
    return [];
}
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
export async function invokeHook(gatewayUrl, token, options) {
    const wantedChannel = options.channel && options.channel !== "last"
        ? options.channel
        : undefined;
    let to = options.to;
    // Auto-resolve target from sessions if not provided.
    if (!to) {
        try {
            const sessions = await listSessions(gatewayUrl, token);
            // Sort by most recently active (updatedAt descending).
            const sorted = [...sessions].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
            // Pick the first session that matches the wanted channel, or the
            // most recently active session overall.
            const match = wantedChannel
                ? sorted.find((s) => s.channel === wantedChannel)
                : sorted[0];
            if (match) {
                // deliveryContext holds the correct `to` for message_send.
                const dc = match
                    .deliveryContext;
                to = dc?.to;
                // If the session doesn't carry a deliveryContext.to, fall back
                // to deriving one from the session key.
                if (!to && match.key) {
                    // Session keys look like "agent:main:slack:channel:C0AE86…"
                    const parts = match.key.split(":");
                    const channelIdx = parts.indexOf("channel");
                    const groupIdx = parts.indexOf("group");
                    const targetIdx = channelIdx !== -1
                        ? channelIdx
                        : groupIdx !== -1
                            ? groupIdx
                            : -1;
                    if (targetIdx !== -1 && parts[targetIdx + 1]) {
                        to = `channel:${parts[targetIdx + 1].toUpperCase()}`;
                    }
                }
            }
            if (!to) {
                return {
                    ok: false,
                    error: wantedChannel
                        ? `No active ${wantedChannel} session found on the Gateway to resolve a delivery target`
                        : "No active sessions found on the Gateway to resolve a delivery target",
                };
            }
        }
        catch (err) {
            return {
                ok: false,
                error: `Failed to resolve delivery target: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
    }
    const args = {
        message: options.message,
        to,
    };
    if (wantedChannel) {
        args.channel = wantedChannel;
    }
    try {
        const response = await fetch(`${gatewayUrl}/tools/invoke`, {
            method: "POST",
            headers: authHeaders(token),
            body: JSON.stringify({
                tool: "message",
                action: "send",
                args,
            }),
        });
        if (response.status === 401) {
            return {
                ok: false,
                error: "Authentication failed — check your Gateway token",
            };
        }
        if (!response.ok) {
            return {
                ok: false,
                error: `Gateway returned HTTP ${response.status}`,
            };
        }
        const data = (await response.json());
        if (!data.ok) {
            return {
                ok: false,
                error: data.error?.message || "Message delivery failed",
            };
        }
        return { ok: true };
    }
    catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
/**
 * Wake the OpenClaw main session by sending a system-level message
 * through the Gateway's `message` tool.
 */
export async function wakeGateway(gatewayUrl, token, text) {
    return invokeHook(gatewayUrl, token, {
        message: text,
        channel: "last",
    });
}
