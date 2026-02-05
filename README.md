# AgentsPD

The security layer between your AI agents and the world.

AgentsPD is the Emotos MCP security proxy for [OpenClaw](https://openclaw.dev). It registers your agent with a cryptographic identity, vaults credentials, enforces policies, and routes all MCP traffic through an Emotos-secured proxy — one command to get started.

## Requirements

- Node.js 20+
- An Emotos org API key (`emotos_org_...`) — get one at [app.emotos.ai](https://app.emotos.ai)

## Setup

Run setup once to register your agent and write the local config:

```sh
node scripts/setup.js
```

You will be prompted for your Emotos org API key. The script validates the key, registers an agent, and writes `config.json` locally (gitignored).

## Start the proxy

```sh
node scripts/start.js
```

This spins up the MCP WebSocket proxy. All tool calls from your OpenClaw agent now flow through Emotos — identity verified, policies enforced, inputs scanned, and every action audited.

## What happens under the hood

| Step | What runs |
|---|---|
| `setup.js` | Validates your org key → registers an agent → writes `config.json` |
| `start.js` | Connects to the Emotos MCP proxy via WebSocket using the registered agent's token |
| At runtime | Every inbound tool call is checked against your security policy before it reaches the underlying tools |

## Configuration

`config.json` is created by `setup.js` and is gitignored. Fields:

| Key | Description |
|---|---|
| `orgApiKey` | Your Emotos org API key |
| `agentId` | The UUID assigned to this agent at registration |
| `apiUrl` | Emotos API base URL (defaults to `https://api.emotos.ai`) |
| `proxyUrl` | MCP proxy WebSocket URL (defaults to `wss://proxy.emotos.ai/v1/mcp`) |

Both URL fields can be overridden via environment variables before running setup:

```sh
EMOTOS_API_URL=http://localhost:3000 EMOTOS_PROXY_URL=ws://localhost:8080 node scripts/setup.js
```

## License

MIT
