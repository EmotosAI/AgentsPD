# Emotos CLI Quick Start

Get up and running with Emotos in 5 minutes.

## Installation

```bash
# Install globally via npm
npm install -g agentspd

# Verify installation
agentspd --version
```

## Create an Account

```bash
# Interactive signup (no role selection needed)
agentspd auth signup

# Or with options
agentspd auth signup --email you@company.com --org-name "My Company"
```

## One-Command Setup

The fastest path -- `init` walks you through signup, policy creation (with AI), agent registration, and token issuance:

```bash
agentspd init
```

## Step-by-Step Setup

### 1. Create a Security Policy

You have three options:

```bash
# Option A: AI-generated policy (recommended)
# When you run `policies create` without --file, you can choose AI generation.
# Describe your agent in plain English and get a production-ready YAML policy.
agentspd policies create --name "my-policy"

# Option B: Generate a template, edit it, then upload
agentspd policies init
code emotos-policy.yaml
agentspd policies create --name "my-policy" --file emotos-policy.yaml

# Option C: Use a YAML file you already have
agentspd policies create --name "my-policy" --file my-policy.yaml
```

### 2. Register Your Agent

```bash
agentspd agents create \
  --name "my-ai-agent" \
  --environment production \
  --policy my-policy
```

Save the API key that's returned!

> **Tip**: You can use the policy name (`my-policy`) instead of a UUID. The CLI resolves names automatically.

### 3. Issue a JWT Token

```bash
# Accepts agent name or UUID
agentspd agents token my-ai-agent
```

### 4. Connect to MCP Proxy

```javascript
const ws = new WebSocket('wss://proxy.emotos.ai/v1/mcp', {
  headers: { 'Authorization': 'Bearer <token>' }
});
```

## Set Up Monitoring

### Real-Time Agent Monitoring (SSE)

```bash
# Watch agent activity in real-time
agentspd agents monitor my-ai-agent
```

### Real-Time Threat Watch (SSE)

```bash
# Watch for threats as they happen
agentspd threats watch

# Filter by severity
agentspd threats watch --severity high

# List recent threats
agentspd threats list --severity high
```

### Audit Logs

```bash
# Query events (agent name or UUID)
agentspd audit events --agent my-ai-agent --limit 50

# Export for compliance
agentspd audit export --start 2026-01-01 --output audit.json
```

## Set Up Alerts

```bash
agentspd webhooks create \
  --url https://your-server.com/emotos \
  --events threat.blocked,agent.suspended
```

## Next Steps

- Read the [Provider Guide](./provider-guide.md) for detailed agent deployment instructions
- Read the [Workspaces Guide](./workspaces.md) for cross-org agent collaboration
- See the [Command Reference](./commands.md) for all available commands
- Check the [Policy Reference](./policy-reference.md) for policy configuration
