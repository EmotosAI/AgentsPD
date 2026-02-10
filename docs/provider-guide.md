# Agent Provider Guide

This guide walks you through deploying and managing secure AI agents with Emotos.

## Overview

As an agent provider, you build and deploy AI agents that interact with external systems. Emotos provides:

- **Cryptographic identity** for each agent
- **Policy enforcement** to control agent capabilities
- **Reputation tracking** to build trust over time
- **Audit logging** for compliance and debugging

## Prerequisites

1. An Emotos account (`agentspd auth signup`)
2. Your AI agent codebase ready to integrate
3. Access to the MCP-compatible tools your agent will use

## Step 1: Create Your Account

```bash
# Sign up
agentspd auth signup

# Or with all options
agentspd auth signup \
  --email developer@acme.com \
  --name "John Developer" \
  --org-name "Acme AI"
```

After signup, you'll be logged in automatically.

## Step 2: Create a Security Policy

Policies define what your agents can and cannot do. You can **generate a policy with AI** by describing your agent, or start with a template:

```bash
# Option A: AI-generated (recommended for new users)
# When run without --file, the CLI offers AI generation.
# Describe your agent in plain English and get a production-ready policy.
agentspd policies create --name "my-agent-policy"

# Option B: Start with a template
agentspd policies init --output my-policy.yaml
code my-policy.yaml  # Edit the policy (see Policy Reference for details)
agentspd policies create --name "my-agent-policy" --file my-policy.yaml
```

### Example Policy

```yaml
version: "1.0"
name: "production-agent-policy"
description: "Security policy for production support agents"

settings:
  default_action: deny
  require_identity: true

# Tool permissions
tools:
  # Allow customer data read
  - pattern: "customer_*"
    action: allow
    constraints:
      read_only: true
      
  # Allow ticket management
  - name: "create_ticket"
    action: allow
    rate_limit:
      requests_per_minute: 30
      
  - name: "update_ticket"
    action: allow
    
  # Block dangerous operations
  - pattern: "admin_*"
    action: deny
    reason: "Admin operations require human approval"
    
  - pattern: "delete_*"
    action: deny
    reason: "Deletion not permitted"

# Prompt injection protection
prompt_injection:
  enabled: true
  action: block
  sensitivity: high
  
# Data exfiltration prevention
exfiltration:
  enabled: true
  block_patterns:
    - name: "ssn"
      pattern: "\\d{3}-\\d{2}-\\d{4}"
    - name: "credit_card"
      pattern: "\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}"
    - name: "api_keys"
      pattern: "sk_live_[a-zA-Z0-9]{24,}"
```

### Upload the Policy

```bash
# Validate first
agentspd policies validate my-policy.yaml

# Create the policy
agentspd policies create \
  --name "Production Support Policy" \
  --file my-policy.yaml

# Save the policy ID for later
# Output: Policy ID: pol_abc123
```

## Step 3: Register Your Agent

```bash
# Register with policy
agentspd agents create \
  --name "support-agent-v1" \
  --description "Customer support AI assistant" \
  --environment production \
  --policy pol_abc123
```

Output:
```
✓ Agent registered successfully!

Agent ID: agent_xyz789
Name: support-agent-v1
Status: active
Environment: production
Reputation: 50/100

⚠ Important: Save this value securely. It will not be shown again.

API Key: emotos_abc123xyz...
```

**Save the API key immediately** - it won't be shown again.

## Step 4: Issue JWT Tokens

Before your agent connects to the MCP proxy, issue a short-lived JWT:

```bash
# Issue a 1-hour token
agentspd agents token agent_xyz789 --ttl 3600

# Output includes the JWT token
```

### Token Claims

The JWT contains:
```json
{
  "iss": "https://identity.emotos.ai",
  "sub": "agent:acme-ai:support-agent-v1",
  "aud": "https://proxy.emotos.ai",
  "emotos": {
    "orgId": "org_acme123",
    "agentId": "agent_xyz789",
    "agentName": "support-agent-v1",
    "permissions": ["mcp:tools/call", "mcp:resources/read"],
    "policyVersion": "v2026.02.02",
    "reputationScore": 50,
    "environment": "production"
  }
}
```

## Step 5: Connect to MCP Proxy

Integrate the Emotos proxy into your agent:

### Node.js / TypeScript

```typescript
import WebSocket from 'ws';

class EmotosAgent {
  private ws: WebSocket | null = null;
  private token: string;
  private proxyUrl = 'wss://proxy.emotos.ai/v1/mcp';

  constructor(token: string) {
    this.token = token;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.proxyUrl, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      this.ws.on('open', () => {
        console.log('Connected to Emotos MCP Proxy');
        resolve();
      });

      this.ws.on('error', (error) => {
        console.error('Connection error:', error);
        reject(error);
      });

      this.ws.on('message', (data) => {
        this.handleMessage(JSON.parse(data.toString()));
      });
    });
  }

  private handleMessage(message: any): void {
    // Handle MCP protocol messages
    // Responses are automatically scanned and filtered by Emotos
  }

  async callTool(name: string, args: any): Promise<any> {
    if (!this.ws) throw new Error('Not connected');
    
    const request = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name, arguments: args },
      id: Date.now()
    };

    this.ws.send(JSON.stringify(request));
    // Handle response...
  }
}

// Usage
const agent = new EmotosAgent(process.env.AGENT_TOKEN!);
await agent.connect();
```

### Python

```python
import asyncio
import websockets
import json
import os

class EmotosAgent:
    def __init__(self, token: str):
        self.token = token
        self.proxy_url = 'wss://proxy.emotos.ai/v1/mcp'
        self.ws = None

    async def connect(self):
        headers = {'Authorization': f'Bearer {self.token}'}
        self.ws = await websockets.connect(
            self.proxy_url,
            extra_headers=headers
        )
        print('Connected to Emotos MCP Proxy')

    async def call_tool(self, name: str, args: dict):
        if not self.ws:
            raise Exception('Not connected')
        
        request = {
            'jsonrpc': '2.0',
            'method': 'tools/call',
            'params': {'name': name, 'arguments': args},
            'id': int(asyncio.get_event_loop().time() * 1000)
        }
        
        await self.ws.send(json.dumps(request))
        response = await self.ws.recv()
        return json.loads(response)

# Usage
async def main():
    agent = EmotosAgent(os.environ['AGENT_TOKEN'])
    await agent.connect()

asyncio.run(main())
```

## Step 6: Monitor Your Agent

### Real-time Monitoring

```bash
# Watch agent activity
agentspd agents monitor agent_xyz789

# Check reputation
agentspd agents get agent_xyz789
```

### Audit Logs

```bash
# View recent events
agentspd audit events --agent agent_xyz789 --limit 20

# Export for analysis
agentspd audit export --agent agent_xyz789 --output audit.json
```

### Threat Alerts

```bash
# View threats
agentspd threats list --agent agent_xyz789

# Watch for new threats
agentspd threats watch --agent agent_xyz789
```

## Step 7: Handle Credentials

### Rotating API Keys

If you suspect a key is compromised:

```bash
# Rotate credentials (revokes old, issues new)
agentspd agents rotate agent_xyz789
```

### Revoking an Agent

If an agent is compromised:

```bash
# Revoke immediately
agentspd agents revoke agent_xyz789 --force
```

## Best Practices

### 1. Use Short-Lived Tokens
Issue tokens with the minimum TTL needed (default: 1 hour, max: 24 hours).

```bash
agentspd agents token agent_xyz789 --ttl 1800  # 30 minutes
```

### 2. Monitor Reputation
Track your agent's reputation score. A dropping score indicates issues:

```bash
agentspd agents get agent_xyz789 | grep reputation
```

### 3. Use Environment Separation
Deploy to development/staging before production:

```bash
# Development
agentspd agents create --name my-agent --environment development

# Staging
agentspd agents create --name my-agent --environment staging

# Production (after testing)
agentspd agents create --name my-agent --environment production
```

### 4. Set Up Webhooks
Get notified of important events:

```bash
agentspd webhooks create \
  --url https://your-server.com/emotos-webhook \
  --events threat.blocked,agent.reputation_changed
```

### 5. Regular Audits
Export and review audit logs regularly:

```bash
agentspd audit export \
  --start $(date -d '-30 days' +%Y-%m-%d) \
  --output monthly-audit.json
```

## Troubleshooting

### Token Rejected
```
Error: TOKEN_EXPIRED
```
Issue a new token - the current one has expired.

### Policy Violation
```
Error: Action denied by policy
```
Check your policy allows the operation, or update the policy.

### Rate Limited
```
Error: Rate limit exceeded
```
Your agent is making too many requests. Add delays or request a limit increase.

### Low Reputation
If reputation drops below 50, some operations may be restricted. Review threats and resolve issues.

## Next Steps

- [Policy Reference](./policy-reference.md) - Complete policy configuration
- [Command Reference](./commands.md) - All available CLI commands
- [Demos & User Flows](./demos.md) - End-to-end walkthroughs
