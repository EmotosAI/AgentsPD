import { createInterface } from 'readline';
import { existsSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';
import { readConfig, writeConfig } from '../src/config.js';
import { validateOrgKey, registerAgent } from '../src/client.js';

const __filename = fileURLToPath(import.meta.url);
const NODE_MODULES = resolve(dirname(__filename), '..', 'node_modules');

async function ensureDeps() {
  if (existsSync(NODE_MODULES)) return;
  const { execSync } = await import('child_process');
  const pkgDir = resolve(dirname(__filename), '..');
  console.log('Installing dependencies...');
  execSync('npm install --production', { cwd: pkgDir, stdio: 'inherit' });
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

async function main() {
  await ensureDeps();

  console.log('\n=== Emotos OpenClaw Setup ===\n');

  const existing = readConfig();
  if (existing.agentId) {
    const redo = await ask(`Already configured (agent: ${existing.agentId}). Re-run setup? [y/N] `);
    if (redo.trim().toLowerCase() !== 'y') {
      console.log('Skipping. Delete config.json in this directory to reset.');
      rl.close();
      return;
    }
  }

  const apiKey = (await ask('Paste your Emotos org API key (emotos_org_...): ')).trim();
  if (!apiKey.startsWith('emotos_org_')) {
    console.error('Invalid key format. Get yours from the Emotos dashboard.');
    rl.close();
    process.exit(1);
  }

  console.log('Validating key...');
  try {
    await validateOrgKey(apiKey);
  } catch (err) {
    console.error('Validation failed:', err.message);
    rl.close();
    process.exit(1);
  }
  console.log('Key valid.');

  console.log('Registering agent...');
  const agent = await registerAgent('openclaw', apiKey);

  writeConfig({
    orgApiKey: apiKey,
    agentId: agent.id,
    apiUrl: process.env.EMOTOS_API_URL || 'https://api.emotos.ai',
    proxyUrl: process.env.EMOTOS_PROXY_URL || 'wss://proxy.emotos.ai/v1/mcp',
  });

  console.log(`\nDone. Agent registered: ${agent.id}`);
  console.log('Start the proxy with:\n  node scripts/start.js\n');
  rl.close();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
