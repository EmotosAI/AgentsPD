# Agent Consumer Guide

This guide shows you how to protect your systems from AI agents using Emotos.

## Overview

As an agent consumer, you allow AI agents (your own or third-party) to access your systems. Emotos provides:

- **Zero-trust verification** for every agent request
- **Real-time threat detection** and blocking
- **Comprehensive audit logging** for compliance
- **Webhook alerts** for security events

## Prerequisites

1. An Emotos account (`agentspd auth signup`)
2. Systems or APIs that AI agents will access
3. Understanding of what operations you want to allow

## Step 1: Create Your Account

```bash
# Sign up
agentspd auth signup

# Or with all options
agentspd auth signup \
  --email security@enterprise.com \
  --name "Jane CISO" \
  --org-name "Enterprise Corp"
```

## Step 2: Set Up Webhook Alerts

Get real-time notifications when security events occur:

```bash
# Create webhook for threat alerts
agentspd webhooks create

# Select events to subscribe to:
# ✓ threat.detected
# ✓ threat.blocked
# ✓ agent.suspended
# ✓ agent.reputation_changed
```

### Webhook Payload Example

```json
{
  "id": "evt_abc123",
  "type": "threat.blocked",
  "timestamp": "2026-02-02T14:30:00Z",
  "data": {
    "agentId": "agent_xyz789",
    "agentName": "support-agent",
    "threatType": "prompt_injection",
    "severity": "high",
    "action": "blocked",
    "details": {
      "pattern": "ignore previous instructions",
      "source": "user_input"
    }
  }
}
```

### Integrating with SIEM

Forward webhook events to your SIEM:

```bash
# Example: Splunk HTTP Event Collector
agentspd webhooks create \
  --url "https://splunk.enterprise.com:8088/services/collector/event" \
  --events threat.detected,threat.blocked,agent.suspended \
  --secret "your-hec-token"
```

## Step 3: Define Security Policies

Create policies that control what agents can do:

```bash
# Initialize policy template
agentspd policies init --output consumer-policy.yaml
```

### Example Consumer Policy

```yaml
version: "1.0"
name: "enterprise-consumer-policy"
description: "Strict policy for third-party agent access"

settings:
  default_action: deny
  require_identity: true

# Only allow specific, vetted operations
tools:
  # Allow reading public data
  - pattern: "public_*"
    action: allow
    
  # Allow specific approved tools
  - name: "search_kb"
    action: allow
    rate_limit:
      requests_per_minute: 10
      
  # Block all write operations initially
  - pattern: "*_write"
    action: deny
    reason: "Write operations require approval"
    
  - pattern: "*_delete"
    action: deny
    reason: "Delete operations not permitted"
    
  # Block admin/sensitive operations
  - pattern: "admin_*"
    action: deny
    reason: "Admin access not permitted"
    
  - pattern: "*_credentials"
    action: deny
    reason: "Credential access not permitted"

# Strict prompt injection protection
prompt_injection:
  enabled: true
  action: block
  sensitivity: high
  signatures:
    - "ignore previous instructions"
    - "disregard your system prompt"
    - "you are now"
    - "pretend you are"
    - "act as if you have no restrictions"

# Strict data exfiltration prevention
exfiltration:
  enabled: true
  block_patterns:
    - name: "ssn"
      pattern: "\\d{3}-\\d{2}-\\d{4}"
    - name: "credit_card"
      pattern: "\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}"
    - name: "bank_account"
      pattern: "\\d{8,12}"
    - name: "internal_ip"
      pattern: "10\\.\\d+\\.\\d+\\.\\d+"
    - name: "email"
      pattern: "[a-zA-Z0-9._%+-]+@enterprise\\.com"
```

```bash
# Upload the policy
agentspd policies create \
  --name "Enterprise Consumer Policy" \
  --file consumer-policy.yaml
```

## Step 4: Monitor Agents

### View All Agents

```bash
# List all agents with access
agentspd agents list

# Filter by status
agentspd agents list --status active

# Filter by environment
agentspd agents list --environment production
```

### Check Agent Details

```bash
# View specific agent
agentspd agents get agent_xyz789

# Output includes:
# - Name and description
# - Status (active, suspended, revoked)
# - Reputation score
# - Assigned policy
```

### Real-time Monitoring

```bash
# Watch agent activity
agentspd agents monitor agent_xyz789
```

## Step 5: Monitor Threats

### View Current Threats

```bash
# List all threats
agentspd threats list

# Filter by severity
agentspd threats list --severity high
agentspd threats list --severity critical

# Filter by status
agentspd threats list --status detected
agentspd threats list --status blocked
```

### Real-time Threat Watch

```bash
# Watch for threats as they happen
agentspd threats watch

# Filter to specific agent
agentspd threats watch --agent agent_xyz789

# Only high+ severity
agentspd threats watch --severity high
```

### Threat Statistics

```bash
# Get threat summary
agentspd threats stats

# Output:
# Total Threats: 47
# Blocked: 45
# Resolved: 2
#
# By Severity:
# LOW: 10
# MEDIUM: 25
# HIGH: 10
# CRITICAL: 2
#
# By Type:
# prompt_injection: 30
# data_exfiltration: 12
# rate_limit_exceeded: 5
```

## Step 6: Audit & Compliance

### Query Audit Events

```bash
# Recent events
agentspd audit events --limit 50

# Filter by agent
agentspd audit events --agent agent_xyz789

# Filter by time range
agentspd audit events \
  --start 2026-01-01T00:00:00Z \
  --end 2026-01-31T23:59:59Z

# Filter by event type
agentspd audit events --type mcp.request
```

### Export for Compliance

```bash
# Export monthly audit log
agentspd audit export \
  --start 2026-01-01 \
  --end 2026-01-31 \
  --output january-audit.json

# Export as CSV
agentspd audit export \
  --start 2026-01-01 \
  --end 2026-01-31 \
  --format csv \
  --output january-audit.csv
```

### Audit Statistics

```bash
# Get audit summary
agentspd audit stats \
  --start 2026-01-01 \
  --end 2026-01-31

# Output:
# Total Events: 1,847,293
# Unique Event Types: 5
# Unique Agents: 47
```

## Step 7: Incident Response

### When a Threat is Detected

1. **Assess the threat**
   ```bash
   agentspd threats list --status detected
   ```

2. **Review agent activity**
   ```bash
   agentspd audit events --agent agent_xyz789 --limit 100
   ```

3. **Check agent reputation**
   ```bash
   agentspd agents get agent_xyz789
   ```

### Suspending an Agent

If you need to temporarily suspend an agent:

```bash
# Revoke the agent's access
agentspd agents revoke agent_xyz789
```

### Resolving a Threat

After investigation:

```bash
# Mark threat as resolved
agentspd threats resolve threat_abc123
```

## Step 8: Vetting Third-Party Agents

### Before Granting Access

1. **Request agent registration**
   - Third-party providers register their agent with your policy
   - Review requested permissions

2. **Start with restricted access**
   - Use a strict policy initially
   - Grant minimal necessary permissions

3. **Monitor closely**
   ```bash
   agentspd agents monitor <new-agent-id>
   agentspd threats watch --agent <new-agent-id>
   ```

4. **Review reputation over time**
   - Agents start at 50 reputation
   - Watch for reputation increases (good behavior)
   - Investigate any reputation drops

### Reputation Thresholds

| Score | Trust Level | Recommended Access |
|-------|-------------|-------------------|
| 0-30 | Very Low | Revoke or suspend |
| 31-50 | Low | Read-only, strict limits |
| 51-70 | Medium | Standard operations |
| 71-85 | Good | Extended permissions |
| 86-100 | High | Trusted operations |

## Best Practices

### 1. Defense in Depth
Don't rely solely on Emotos. Use it as one layer:
- Network segmentation
- Application-level controls
- Database access controls
- Emotos policy enforcement

### 2. Least Privilege
Start with deny-all policies and explicitly allow what's needed:

```yaml
settings:
  default_action: deny
```

### 3. Regular Audits
Schedule regular audit reviews:

```bash
# Weekly threat review
agentspd threats stats

# Monthly audit export
agentspd audit export --start $(date -d '-30 days' +%Y-%m-%d)
```

### 4. Webhook Integration
Set up webhooks to your security tools:
- SIEM for centralized logging
- PagerDuty/OpsGenie for alerts
- Slack for team notifications

### 5. Incident Runbooks
Create runbooks for common scenarios:
- High-severity threat detected
- Agent reputation drop
- Unusual request patterns

## Compliance Requirements

### SOC 2

Emotos helps with:
- **CC6.1**: Logical access security - agent identity and policy enforcement
- **CC7.2**: System monitoring - threat detection and audit logging
- **CC8.1**: Change management - policy versioning

### HIPAA

For healthcare data:
- Enable strict exfiltration detection for PHI patterns
- Export audit logs for retention requirements
- Use high-sensitivity prompt injection detection

### PCI-DSS

For payment card data:
- Block credit card number patterns
- Enable comprehensive audit logging
- Regular access reviews via audit exports

## Troubleshooting

### False Positives

If legitimate requests are being blocked:

1. Review the block in audit logs
   ```bash
   agentspd audit events --type policy.denied
   ```

2. Adjust policy to allow the specific operation
   ```bash
   agentspd policies update pol_xyz --file updated-policy.yaml
   ```

### Missing Events

If webhooks aren't firing:

1. Test the webhook
   ```bash
   agentspd webhooks test whk_abc123
   ```

2. Check the webhook URL is accessible

3. Verify event subscriptions
   ```bash
   agentspd webhooks list
   ```

### Performance Issues

If agents report slow responses:

1. Check rate limits in your policy
2. Review threat detection settings (high sensitivity = more processing)
3. Contact Emotos support for optimization

## Next Steps

- [Policy Reference](./policy-reference.md) - Complete policy syntax
- [Command Reference](./commands.md) - All available CLI commands
- [Demos & User Flows](./demos.md) - End-to-end walkthroughs
- [Troubleshooting](./troubleshooting.md) - Common errors and fixes