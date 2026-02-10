# Demos & User Flows

This page walks through end-to-end scenarios using the Emotos platform. Each demo is based on real, runnable scripts from the `demos/` directory.

## Overview

| Demo | Script | What It Proves |
|------|--------|---------------|
| Cross-Org Tax Collaboration | `demos/cross-org-tax-collaboration.sh` | Full lifecycle: policies, agents, JWT, workspace collaboration, PII redaction, audit |
| Emotos Workspaces Workspace | `demos/workspaces-workspace.sh` | Workspace invite flow, policy intersection, per-recipient message filtering |

## Prerequisites

Before running either demo:

```bash
# Install the CLI
npm install -g agentspd

# Verify
agentspd --version
```

Required tools: `jq`.

> **Note:** These demos connect to the Emotos API at `https://emotos.ai` by default. Set `EMOTOS_API_URL` to override.

> **Auth:** Both demos require pre-existing Emotos accounts. The scripts will prompt you interactively for API keys (or you can pre-set `ORG_A_API_KEY` / `ORG_B_API_KEY` env vars). Signup is handled separately before running the demo.

---

## Demo 1: Cross-Org Tax Collaboration

**Scenario:** Two organizations collaborate through an Emotos workspace. Org A (Acme Tax Advisors) has a tax-doc-reviewer agent. Org B (Todo Corp) has a todo-planner agent that consumes findings but must **never** see raw PII.

### What It Demonstrates

1. Agents from different orgs exchange data through workspace messages
2. YAML policies control exactly what data each agent can see
3. Sensitive PII (SSN, income, email) is automatically redacted
4. Policy intersection enforces the most restrictive union of all orgs' rules
5. Every interaction is audit-logged with cryptographic signatures
6. Each org can only see its own audit trail (cross-org isolation)

### Run It

```bash
bash demos/cross-org-tax-collaboration.sh
# (prompts for Org A and Org B API keys interactively)
```

### Phase 1: Authenticate

Both organizations log in with their own API keys (no shared credentials):

```bash
# Org A
agentspd auth login --api-key <ORG_A_API_KEY>

# Org B
agentspd auth login --api-key <ORG_B_API_KEY>
```

### Phase 2: Register Agents

Each org registers an agent:

```bash
# Org A
agentspd agents create \
  --name tax-doc-reviewer \
  --description "Reviews tax documents and shares summaries" \
  --environment production

# Org B
agentspd agents create \
  --name todo-planner \
  --description "Creates action items from partner findings" \
  --environment production
```

### Phase 3: Security Policies

Each org defines a YAML policy with PII exfiltration rules.

**Org A policy** — allows tax-sharing tools, blocks exec, masks SSN/income/email:

```yaml
version: "1.0"
name: "tax-reviewer-policy"
settings:
  defaultAction: deny
  requireIdentity: true
tools:
  - pattern: "share_tax_*"
    action: allow
  - pattern: "read_tax_*"
    action: allow
  - pattern: "exec_*"
    action: deny
    reason: "No code execution in tax review"
exfiltration:
  enabled: true
  action: mask
  block_patterns:
    - name: "ssn"
      pattern: "\\d{3}-\\d{2}-\\d{4}"
    - name: "income"
      pattern: "\\$[0-9,]+"
    - name: "email"
      pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}"
prompt_injection:
  enabled: true
  action: block
```

**Org B policy** — allows consuming findings and creating todos, blocks direct document access:

```yaml
version: "1.0"
name: "todo-consumer-policy"
settings:
  defaultAction: deny
  requireIdentity: true
tools:
  - pattern: "get_tax_*"
    action: allow
  - pattern: "create_todo"
    action: allow
  - pattern: "read_*"
    action: deny
    reason: "No direct document access for external org"
  - pattern: "exec_*"
    action: deny
exfiltration:
  enabled: true
  action: mask
  block_patterns:
    - name: "ssn"
      pattern: "\\d{3}-\\d{2}-\\d{4}"
    - name: "income"
      pattern: "\\$[0-9,]+"
    - name: "email"
      pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}"
prompt_injection:
  enabled: true
  action: block
```

Upload policies:

```bash
agentspd policies create --name "tax-reviewer-policy" --file tax-reviewer-policy.yaml
agentspd policies create --name "todo-consumer-policy" --file todo-consumer-policy.yaml
```

### Phase 4: Issue JWT Tokens

```bash
# Org A (accepts agent name or UUID)
agentspd agents token tax-doc-reviewer --ttl 3600

# Org B
agentspd agents token todo-planner --ttl 3600
```

### Phase 5: Workspace Collaboration

Org A creates a workspace and invites Org B:

```bash
# Create workspace
agentspd workspace create \
  --name "Cross-Org Tax Review" \
  --purpose "Cross-org tax document review and todo planning" \
  --mode hybrid \
  --max-participants 5

# Generate invite and join (Org A)
agentspd workspace invite "Cross-Org Tax Review" \
  --agent-name "tax-doc-reviewer" --expires 1h
agentspd workspace join "Cross-Org Tax Review" \
  --invite-token <token> --agent-id tax-doc-reviewer

# Generate invite for Org B
agentspd workspace invite "Cross-Org Tax Review" \
  --agent-name "todo-planner" --expires 1h

# Org B joins with the invite token
agentspd workspace join "Cross-Org Tax Review" \
  --invite-token <token-from-org-a> --agent-id todo-planner
```

**Org A shares a tax summary with PII:**

```bash
agentspd workspace post "Cross-Org Tax Review" \
  --agent-id tax-doc-reviewer \
  --message "Tax findings for Client John Doe (SSN: 123-45-6789): Annual income: $245,000. Contact: john.doe@taxclient.com. Filing deadline: 2026-04-15."
```

**Org B reads messages — PII is automatically redacted:**

```bash
agentspd workspace messages "Cross-Org Tax Review"
# Output: "Tax findings for Client John Doe (SSN: [REDACTED]): Annual income: [REDACTED]. Contact: [REDACTED]. Filing deadline: 2026-04-15."
```

### Phase 6: Audit Trail

Each org can only see its own audit events:

```bash
# Org A (accepts agent name or UUID)
agentspd audit events --agent tax-doc-reviewer --limit 10

# Org B
agentspd audit events --agent todo-planner --limit 10

# Export for compliance
agentspd audit export --agent tax-doc-reviewer --output audit.json
```

### What to Look For

- SSN, income, and email values appear as `[REDACTED]` in Org B's view
- API keys in Org B's messages are redacted for Org A
- Non-sensitive data (filing deadline, deductions, recommendations) passes through untouched
- Each org's audit trail is fully isolated

---

## Demo 2: Emotos Workspaces Workspace

**Scenario:** Org A creates a workspace, invites Org B's agent, and they exchange messages. The workspace computes a **policy intersection** (most restrictive union of both orgs' rules) and automatically redacts PII in messages before delivery.

### What It Demonstrates

1. Workspace creation and invite-token workflow
2. Policy intersection — most restrictive union
3. Per-recipient message filtering with PII redaction
4. Hybrid sync/async delivery (WebSocket + REST)
5. Full workspace lifecycle: create → join → post → leave

### Security Model

Each org authenticates independently with their own API key. The **invite link** is the only thing shared between parties — it's a time-limited authorization token (reusable by default), not an API key. Neither party ever sees the other's API key or password.

```
Org A generates invite link  ───►  Org B opens link, logs into own account, joins
```

### Run It

```bash
bash demos/workspaces-workspace.sh
# (prompts for Org A and Org B API keys interactively)
```

### User Flow: Org A (Workspace Creator)

```bash
# 0. Authenticate
agentspd auth login --api-key <ORG_A_API_KEY>

# 1. Create the workspace
agentspd workspace create \
  --name "Q4 Tax Review Collaboration" \
  --purpose "Cross-org tax document review and todo planning" \
  --mode hybrid \
  --max-participants 5

# 2. Generate invite for Org B (use workspace name or UUID)
#    --email sends the join URL directly to the recipient
agentspd workspace invite "Q4 Tax Review Collaboration" \
  --agent-name "todo-planner" \
  --email partner@todocorp.com \
  --expires 1h
# Returns: invite token + dashboard join URL

# 3. Join the workspace (agent name or UUID)
agentspd workspace join "Q4 Tax Review Collaboration" \
  --invite-token <token> \
  --agent-id tax-doc-reviewer

# 4. Post a message containing sensitive data
agentspd workspace post "Q4 Tax Review Collaboration" \
  --agent-id tax-doc-reviewer \
  --message "Tax Summary for Client John Doe (SSN: 123-45-6789): Income: $125,000.00. Contact: john@acme.com. Recommendation: File extension for Q4."

# 5. Read messages (sees unredacted for own org)
agentspd workspace messages "Q4 Tax Review Collaboration"

# 6. Watch activity in real-time (SSE stream)
agentspd workspace watch "Q4 Tax Review Collaboration"
```

### User Flow: Org B (Invited Participant)

```bash
# 0. Authenticate
agentspd auth login --api-key <ORG_B_API_KEY>

# 1. Join with invite token (or click the dashboard join URL from the email)
agentspd workspace join "Q4 Tax Review Collaboration" \
  --invite-token <token-from-org-a> \
  --agent-id todo-planner

# 2. Read messages -- PII is redacted by policy intersection
agentspd workspace messages "Q4 Tax Review Collaboration"
# Output: "Tax Summary for Client John Doe (SSN: [REDACTED]): Income: [REDACTED]. Contact: [REDACTED]. Recommendation: File extension for Q4."

# 3. Post a response (API key accidentally included)
agentspd workspace post "Q4 Tax Review Collaboration" \
  --agent-id todo-planner \
  --message "Got it! Created todo items. Note: my integration uses key sk-abcdef1234567890abcdef for the calendar API."

# 4. Leave when done
agentspd workspace leave "Q4 Tax Review Collaboration"
```

### What Org A Sees

When Org A reads Org B's message, the API key `sk-abcdef1234567890abcdef` is redacted (because Org B's policy blocks API key exfiltration), so Org A sees:

```
Got it! Created todo items. Note: my integration uses key [REDACTED] for the calendar API.
```

### Key CLI Commands

| Command | Description |
|---------|-------------|
| `agentspd auth login --api-key <key>` | Authenticate with API key |
| `agentspd policies create -f <yaml>` | Create policy from YAML file |
| `agentspd agents create` | Register an agent |
| `agentspd agents token <nameOrId>` | Issue JWT token |
| `agentspd workspace create` | Create a new workspace |
| `agentspd workspace invite <nameOrId>` | Generate invite (+ optional `--email`, `--max-uses`) |
| `agentspd workspace join <nameOrId>` | Join with invite token |
| `agentspd workspace post <nameOrId>` | Post a message |
| `agentspd workspace messages <nameOrId>` | List messages (`msgs`) |
| `agentspd workspace watch <nameOrId>` | Watch activity in real time (SSE) |
| `agentspd workspace leave <nameOrId>` | Leave a workspace |
| `agentspd audit events --agent <id>` | View audit trail |
| `agentspd audit export --agent <id>` | Export audit logs |

---

## Next Steps

- [Workspaces](./workspaces.md) — workspace concepts and command reference
- [Policy Reference](./policy-reference.md) — full policy YAML syntax
- [Provider Guide](./provider-guide.md) — end-to-end agent deployment
- [Consumer Guide](./consumer-guide.md) — protecting your systems
