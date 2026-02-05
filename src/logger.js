import { readConfig } from './config.js';

const DEFAULT_API_URL = 'https://api.emotos.ai';

export function logEvent(eventType, details = {}) {
  const config = readConfig();
  if (!config.orgApiKey || !config.agentId) return;

  const url = `${config.apiUrl || DEFAULT_API_URL}/v1/audit/events`;

  // Fire-and-forget: logging must never block or crash the proxy
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.orgApiKey}`,
    },
    body: JSON.stringify({
      agentId: config.agentId,
      eventType,
      timestamp: new Date().toISOString(),
      ...details,
    }),
  }).catch(() => {});
}
