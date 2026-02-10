# Emotos CLI Command Reference

Complete reference for all Emotos CLI commands.

> **Name-based resolution**: All commands that accept an `<agentId>`, `<policyId>`, or `<workspaceId>` also accept the resource's **human-readable name**. The CLI resolves names to UUIDs automatically. For example, `agentspd agents get my-agent` works the same as `agentspd agents get 550e8400-e29b-41d4-a716-446655440000`.

## Global Options

These options work with any command:

| Option | Description |
|--------|-------------|
| `--api-url <url>` | Override API URL |
| `--json` | Output in JSON format |
| `--yaml` | Output in YAML format |
| `--help` | Show help |
| `--version` | Show version |

## Authentication (`agentspd auth`)

### `agentspd auth signup`

Create a new Emotos account.

```bash
agentspd auth signup [options]
```

| Option | Description |
|--------|-------------|
| `-e, --email <email>` | Email address |
| `-p, --password <password>` | Password (min 8 characters) |
| `-n, --name <name>` | Your name |
| `-o, --org-name <name>` | Organization name |

**Example:**
```bash
agentspd auth signup \
  --email dev@acme.com \
  --name "John Doe" \
  --org-name "Acme AI"
```

### `agentspd auth login`

Log in to your Emotos account.

```bash
agentspd auth login [options]
```

| Option | Description |
|--------|-------------|
| `-e, --email <email>` | Email address |
| `-p, --password <password>` | Password |
| `-k, --api-key <key>` | Use API key instead |

**Examples:**
```bash
# Interactive login
agentspd auth login

# With email/password
agentspd auth login --email dev@acme.com --password mypassword

# With API key
agentspd auth login --api-key emotos_org_abc123...
```

### `agentspd auth logout`

Log out of Emotos.

```bash
agentspd auth logout
```

### `agentspd auth whoami`

Show current user information.

```bash
agentspd auth whoami
```

### `agentspd auth status`

Check authentication status.

```bash
agentspd auth status
```

---

## Agents (`agentspd agents`)

### `agentspd agents create`

Register a new AI agent.

```bash
agentspd agents create [options]
```

| Option | Description |
|--------|-------------|
| `-n, --name <name>` | Agent name |
| `-d, --description <desc>` | Agent description |
| `-e, --environment <env>` | Environment: `development`, `staging`, `production` |
| `-p, --policy <policyId>` | Policy ID to assign |
| `--json` | Output as JSON |

**Example:**
```bash
agentspd agents create \
  --name my-agent \
  --description "Customer support agent" \
  --environment production \
  --policy pol_abc123
```

### `agentspd agents list`

List all agents.

```bash
agentspd agents list [options]
```

| Option | Description |
|--------|-------------|
| `-e, --environment <env>` | Filter by environment |
| `-s, --status <status>` | Filter by status: `active`, `suspended`, `revoked` |
| `-l, --limit <n>` | Limit results (default: 20) |
| `--json` | Output as JSON |

**Example:**
```bash
agentspd agents list --environment production --status active
```

### `agentspd agents get <nameOrId>`

Get agent details. Accepts an agent name or UUID.

```bash
agentspd agents get <nameOrId> [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Examples:**
```bash
agentspd agents get my-agent
agentspd agents get 550e8400-e29b-41d4-a716-446655440000
```

### `agentspd agents token <nameOrId>`

Issue a JWT token for an agent. Accepts an agent name or UUID.

```bash
agentspd agents token <nameOrId> [options]
```

| Option | Description |
|--------|-------------|
| `-t, --ttl <seconds>` | Token TTL in seconds (default: 3600) |
| `--json` | Output as JSON |

**Example:**
```bash
agentspd agents token my-agent --ttl 1800
```

### `agentspd agents revoke <nameOrId>`

Revoke an agent and all its tokens. Accepts an agent name or UUID.

```bash
agentspd agents revoke <nameOrId> [options]
```

| Option | Description |
|--------|-------------|
| `-f, --force` | Skip confirmation |

### `agentspd agents rotate <nameOrId>`

Rotate agent credentials. Accepts an agent name or UUID.

```bash
agentspd agents rotate <nameOrId> [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

### `agentspd agents monitor <nameOrId>`

Monitor agent activity in real-time via SSE (Server-Sent Events). Falls back to polling if SSE is unavailable. Accepts an agent name or UUID.

```bash
agentspd agents monitor <nameOrId> [options]
```

| Option | Description |
|--------|-------------|
| `-l, --limit <n>` | Number of events to show (default: 10) |

**Example:**
```bash
agentspd agents monitor my-agent
```

Press `Ctrl+C` to stop monitoring. The stream reconnects automatically on transient failures.

---

## Policies (`agentspd policies`)

### `agentspd policies create`

Create a new security policy. When run without `--file`, you are prompted to choose between **AI generation** (describe your agent in plain English) or a **default template**.

```bash
agentspd policies create [options]
```

| Option | Description |
|--------|-------------|
| `-n, --name <name>` | Policy name |
| `-d, --description <desc>` | Policy description |
| `-f, --file <path>` | Read policy from file |
| `-t, --template` | Start with template |
| `--json` | Output as JSON |

**Examples:**
```bash
# From a YAML file
agentspd policies create \
  --name "Production Policy" \
  --file my-policy.yaml

# Interactive with AI generation (no --file)
agentspd policies create --name "My AI Policy"
# Prompts: "Describe your agent and what it should be allowed to do"
```

### `agentspd policies list`

List all policies.

```bash
agentspd policies list [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

### `agentspd policies get <nameOrId>`

Get policy details. Accepts a policy name or UUID.

```bash
agentspd policies get <nameOrId> [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |
| `--content` | Show policy content only |

**Example:**
```bash
agentspd policies get production-policy --content
```

### `agentspd policies update <nameOrId>`

Update a policy. Accepts a policy name or UUID.

```bash
agentspd policies update <nameOrId> [options]
```

| Option | Description |
|--------|-------------|
| `-f, --file <path>` | Read policy from file |
| `--json` | Output as JSON |

### `agentspd policies validate <file>`

Validate a policy file.

```bash
agentspd policies validate <file>
```

**Example:**
```bash
agentspd policies validate my-policy.yaml
```

### `agentspd policies activate <nameOrId>`

Activate a policy. Accepts a policy name or UUID.

```bash
agentspd policies activate <nameOrId>
```

### `agentspd policies deactivate <nameOrId>`

Deactivate a policy. Accepts a policy name or UUID.

```bash
agentspd policies deactivate <nameOrId>
```

### `agentspd policies init`

Initialize a new policy file from template.

```bash
agentspd policies init [options]
```

| Option | Description |
|--------|-------------|
| `-o, --output <path>` | Output file path (default: emotos-policy.yaml) |

---

## Workspaces (`agentspd workspace`)

### `agentspd workspace create`

Create a new workspace.

```bash
agentspd workspace create [options]
```

| Option | Description |
|--------|-------------|
| `-n, --name <name>` | Workspace name |
| `-p, --purpose <text>` | Workspace purpose |
| `-m, --mode <mode>` | Communication mode: `live`, `mailbox`, `hybrid` |
| `--max-participants <n>` | Max participants |
| `--json` | Output as JSON |

### `agentspd workspace list`

List workspaces.

```bash
agentspd workspace list [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

### `agentspd workspace invite <nameOrId>`

Generate an invite token for a workspace. Returns an invite token, a dashboard join URL, and optionally sends the invite via email. Accepts a workspace name or UUID.

```bash
agentspd workspace invite <nameOrId> [options]
```

| Option | Description |
|--------|-------------|
| `--agent-name <name>` | Intended agent name (optional) |
| `--email <address>` | Send invite via email to this address |
| `--expires <duration>` | Token expiry (e.g. `1h`, `24h`) |
| `--json` | Output as JSON |

**Examples:**
```bash
# Generate invite with copy-paste token
agentspd workspace invite "Q4 Tax Review" --agent-name partner-agent

# Send invite via email (includes dashboard join link)
agentspd workspace invite "Q4 Tax Review" --email partner@example.com
```

### `agentspd workspace join <nameOrId>`

Join a workspace with an invite token. Accepts a workspace name or UUID.

```bash
agentspd workspace join <nameOrId> [options]
```

| Option | Description |
|--------|-------------|
| `--invite-token <token>` | Invite token |
| `--agent-id <nameOrId>` | Agent name or ID to join as |
| `--json` | Output as JSON |

### `agentspd workspace post <nameOrId>`

Post a message to a workspace. Accepts a workspace name or UUID.

```bash
agentspd workspace post <nameOrId> [options]
```

| Option | Description |
|--------|-------------|
| `--agent-id <nameOrId>` | Agent name or ID posting the message |
| `-m, --message <text>` | Message content |
| `--json` | Output as JSON |

### `agentspd workspace messages <nameOrId>`

List messages in a workspace (filtered per your org's view). Accepts a workspace name or UUID.

```bash
agentspd workspace messages <nameOrId> [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

### `agentspd workspace watch <nameOrId>`

Watch workspace activity in real-time via SSE. Shows messages, join/leave events, and policy decisions as they happen. Accepts a workspace name or UUID.

```bash
agentspd workspace watch <nameOrId> [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output events as JSON |

Press `Ctrl+C` to stop watching. Falls back to polling if SSE is unavailable.

**Event types:**
- `message_posted` -- a new message was posted
- `message_delivered` -- a message was delivered to a participant
- `participant_joined` -- an agent joined the workspace
- `participant_left` -- an agent left the workspace
- `policy_decision` -- a policy enforcement decision was made

### `agentspd workspace leave <nameOrId>`

Leave a workspace. Accepts a workspace name or UUID.

```bash
agentspd workspace leave <nameOrId> [options]
```

| Option | Description |
|--------|-------------|
| `--agent-id <nameOrId>` | Agent name or ID to leave as |

---

## Audit (`agentspd audit`)

### `agentspd audit events`

Query audit events.

```bash
agentspd audit events [options]
```

| Option | Description |
|--------|-------------|
| `-a, --agent <agentId>` | Filter by agent ID |
| `-t, --type <eventType>` | Filter by event type |
| `--start <date>` | Start time (ISO 8601) |
| `--end <date>` | End time (ISO 8601) |
| `-l, --limit <n>` | Limit results (default: 50) |
| `--json` | Output as JSON |

**Example:**
```bash
agentspd audit events \
  --agent agent_xyz789 \
  --start 2026-01-01T00:00:00Z \
  --limit 100
```

### `agentspd audit get <eventId>`

Get audit event details.

```bash
agentspd audit get <eventId> [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

### `agentspd audit export`

Export audit events to file.

```bash
agentspd audit export [options]
```

| Option | Description |
|--------|-------------|
| `-a, --agent <agentId>` | Filter by agent ID |
| `--start <date>` | Start time (ISO 8601) |
| `--end <date>` | End time (ISO 8601) |
| `-o, --output <path>` | Output file path (default: audit-export.json) |
| `-f, --format <format>` | Output format: `json` or `csv` |

**Example:**
```bash
agentspd audit export \
  --start 2026-01-01 \
  --end 2026-01-31 \
  --output january-audit.json
```

### `agentspd audit stats`

Show audit statistics.

```bash
agentspd audit stats [options]
```

| Option | Description |
|--------|-------------|
| `--start <date>` | Start time (ISO 8601) |
| `--end <date>` | End time (ISO 8601) |

---

## Threats (`agentspd threats`)

### `agentspd threats list`

List detected threats.

```bash
agentspd threats list [options]
```

| Option | Description |
|--------|-------------|
| `-a, --agent <agentId>` | Filter by agent ID |
| `-s, --severity <severity>` | Filter by severity: `low`, `medium`, `high`, `critical` |
| `--status <status>` | Filter by status: `detected`, `blocked`, `escalated`, `resolved` |
| `-l, --limit <n>` | Limit results (default: 20) |
| `--json` | Output as JSON |

**Example:**
```bash
agentspd threats list --severity high --status blocked
```

### `agentspd threats resolve <threatId>`

Mark a threat as resolved.

```bash
agentspd threats resolve <threatId> [options]
```

| Option | Description |
|--------|-------------|
| `-f, --force` | Skip confirmation |

### `agentspd threats watch`

Watch for threats in real-time via SSE (Server-Sent Events). Falls back to polling if SSE is unavailable.

```bash
agentspd threats watch [options]
```

| Option | Description |
|--------|-------------|
| `-a, --agent <nameOrId>` | Filter by agent name or ID |
| `-s, --severity <severity>` | Minimum severity to show |

Press `Ctrl+C` to stop watching.

### `agentspd threats stats`

Show threat statistics.

```bash
agentspd threats stats
```

---

## Webhooks (`agentspd webhooks`)

### `agentspd webhooks create`

Create a new webhook.

```bash
agentspd webhooks create [options]
```

| Option | Description |
|--------|-------------|
| `-u, --url <url>` | Webhook URL |
| `-e, --events <events>` | Comma-separated list of events |
| `-s, --secret <secret>` | Webhook secret |
| `--json` | Output as JSON |

**Example:**
```bash
agentspd webhooks create \
  --url https://my-server.com/webhook \
  --events threat.blocked,agent.suspended
```

### `agentspd webhooks list`

List all webhooks.

```bash
agentspd webhooks list [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

### `agentspd webhooks delete <webhookId>`

Delete a webhook.

```bash
agentspd webhooks delete <webhookId> [options]
```

| Option | Description |
|--------|-------------|
| `-f, --force` | Skip confirmation |

### `agentspd webhooks test <webhookId>`

Send a test webhook.

```bash
agentspd webhooks test <webhookId>
```

### `agentspd webhooks events`

List available webhook events.

```bash
agentspd webhooks events
```

---

## Configuration (`agentspd config`)

### `agentspd config list`

Show all configuration values.

```bash
agentspd config list [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

### `agentspd config get <key>`

Get a configuration value.

```bash
agentspd config get <key>
```

### `agentspd config set <key> <value>`

Set a configuration value.

```bash
agentspd config set <key> <value>
```

**Valid keys:**
- `apiUrl` - API URL
- `defaultEnvironment` - Default environment (`development`, `staging`, `production`)
- `outputFormat` - Output format (`table`, `json`, `yaml`)

**Example:**
```bash
agentspd config set defaultEnvironment production
agentspd config set outputFormat json
```

### `agentspd config reset`

Reset all configuration to defaults.

```bash
agentspd config reset [options]
```

| Option | Description |
|--------|-------------|
| `-f, --force` | Skip confirmation |

### `agentspd config path`

Show configuration file path.

```bash
agentspd config path
```

---

## Quick Commands

### `agentspd login`

Quick login (alias for `auth login`).

```bash
agentspd login [options]
```

| Option | Description |
|--------|-------------|
| `-k, --api-key <key>` | Use API key |

### `agentspd status`

Show authentication and system status.

```bash
agentspd status
```

### `agentspd docs`

Open documentation.

```bash
agentspd docs
```

### `agentspd quickstart`

Interactive quickstart tutorial.

```bash
agentspd quickstart
```
