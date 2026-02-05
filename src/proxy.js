import WebSocket from 'ws';
import { readConfig } from './config.js';
import { issueToken } from './client.js';
import { logEvent } from './logger.js';

const LOCAL_PORT = 8765;
const REFRESH_BUFFER_MS = 60_000;

export class EmotosMCPProxy {
  constructor() {
    this.upstream = null;
    this.pending = new Map();
    this.token = null;
    this.tokenExpiresAt = 0;
    this.refreshTimeout = null;
  }

  async start() {
    await this.refreshToken();
    this.connectUpstream();

    const wss = new WebSocket.Server({ port: LOCAL_PORT });
    wss.on('connection', (ws) => {
      ws.on('message', async (raw) => {
        const startTime = Date.now();
        let msg;
        try {
          msg = JSON.parse(raw);
        } catch {
          ws.send(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid JSON' } }));
          logEvent('proxy.error', { context: { sessionId: 'parse_error' } });
          return;
        }

        try {
          const response = await this.forward(msg);
          ws.send(JSON.stringify(response));
          logEvent(msg.method || 'unknown', {
            request: { method: msg.method, toolName: msg.params?.name, requestId: String(msg.id ?? ''), arguments: msg.params?.arguments },
            response: { status: response.error ? 'error' : 'success', durationMs: Date.now() - startTime, filtered: false },
          });
        } catch (err) {
          ws.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id ?? null, error: { code: -32603, message: err.message } }));
          logEvent(msg.method || 'proxy.error', {
            request: { method: msg.method, toolName: msg.params?.name, requestId: String(msg.id ?? '') },
            response: { status: 'error', durationMs: Date.now() - startTime, filtered: false },
          });
        }
      });
    });

    logEvent('proxy.started', { context: { sessionId: `local_${Date.now()}` } });
    console.log(`Emotos MCP proxy listening on ws://127.0.0.1:${LOCAL_PORT}`);
  }

  connectUpstream() {
    const config = readConfig();
    const proxyUrl = config.proxyUrl || 'wss://proxy.emotos.ai/v1/mcp';

    this.upstream = new WebSocket(proxyUrl, {
      headers: { Authorization: `Bearer ${this.token}` },
    });

    this.upstream.on('open', () => {
      logEvent('proxy.connected', { context: { sessionId: `upstream_${Date.now()}` } });
    });

    this.upstream.on('message', (raw) => {
      const msg = JSON.parse(raw);
      const resolve = this.pending.get(msg.id);
      if (resolve) {
        resolve(msg);
        this.pending.delete(msg.id);
      }
    });

    this.upstream.on('close', () => {
      logEvent('proxy.disconnected', { context: { sessionId: `upstream_${Date.now()}` } });
      console.log('Upstream disconnected, reconnecting...');
      setTimeout(() => this.connectUpstream(), 2000);
    });

    this.upstream.on('error', (err) => {
      logEvent('proxy.error', { context: { sessionId: `upstream_error_${Date.now()}` } });
      console.error('Upstream error:', err.message);
    });
  }

  async forward(request) {
    if (!this.upstream || this.upstream.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to Emotos proxy. Check your network or token.');
    }

    const id = request.id ?? crypto.randomUUID();
    request.id = id;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Upstream request timed out after 30s'));
      }, 30_000);

      this.pending.set(id, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });

      this.upstream.send(JSON.stringify(request));
    });
  }

  async refreshToken() {
    const config = readConfig();
    if (!config.agentId || !config.orgApiKey) {
      throw new Error('Not configured. Run: node scripts/setup.js');
    }

    const result = await issueToken(config.agentId, config.orgApiKey);
    this.token = result.token;
    this.tokenExpiresAt = new Date(result.expiresAt).getTime();

    const delay = this.tokenExpiresAt - Date.now() - REFRESH_BUFFER_MS;
    if (this.refreshTimeout) clearTimeout(this.refreshTimeout);
    this.refreshTimeout = setTimeout(() => this.refreshToken(), delay > 0 ? delay : 0);

    logEvent('proxy.token_refreshed', { context: { sessionId: `token_${Date.now()}` } });
    console.log('Token refreshed, valid until', new Date(result.expiresAt).toISOString());
  }
}
