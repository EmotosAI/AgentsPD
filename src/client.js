import { readConfig } from './config.js';

const DEFAULT_API_URL = process.env.EMOTOS_API_URL || 'https://api.emotos.ai';

async function request(method, path, body, apiKey) {
  const config = readConfig();
  const url = `${config.apiUrl || DEFAULT_API_URL}/v1${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey || config.orgApiKey}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return data;
}

export async function validateOrgKey(apiKey) {
  return request('POST', '/auth/validate', null, apiKey);
}

export async function registerAgent(name, apiKey) {
  return request('POST', '/agents', {
    name,
    description: 'OpenClaw agent — managed by @emotos/openclaw',
    environment: 'production',
  }, apiKey);
}

export async function issueToken(agentId, apiKey, ttlSeconds = 3600) {
  return request('POST', `/agents/${agentId}/token`, { ttlSeconds }, apiKey);
}
