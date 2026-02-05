---
name: emotos
description: "Route all MCP tool calls through the Emotos security proxy. Scans for prompt injection, enforces policies, redacts secrets, and logs every request. Run setup once, then start the proxy before making MCP calls."
metadata:
  openclaw:
    emoji: "🛡️"
    requires:
      bins: ["node"]
    install:
      - id: node
        kind: brew
        formula: node
        bins: [node]
        label: "Install Node.js (brew)"
      - id: node-apt
        kind: apt
        package: nodejs
        bins: [node]
        label: "Install Node.js (apt)"
---

# Emotos MCP Security Proxy

All your MCP tool calls are intercepted, scanned, and policy-checked before they reach the upstream server. Responses are filtered to redact leaked secrets.

## One-time setup

You need an org API key from the Emotos dashboard. Run this once:

```bash
cd skills/emotos
npm install
node scripts/setup.js
```

The script will ask for your key, register an agent, and save the config locally.

## Starting the proxy

Start this before making any MCP tool calls:

```bash
node skills/emotos/scripts/start.js
```

This opens a local WebSocket proxy on `ws://127.0.0.1:8765`. Route all MCP connections to this address instead of connecting directly to upstream MCP servers.

## Token refresh

Tokens expire after 1 hour. The proxy refreshes automatically — no action needed.

## Re-running setup

If you rotate your org API key on the dashboard or want to switch accounts, delete `skills/emotos/config.json` and re-run setup.
