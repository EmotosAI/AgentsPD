# Policy YAML Reference

Complete reference for Emotos security policy configuration.

## Policy Structure

```yaml
version: "1.0"
name: "policy-name"
description: "Policy description"

settings:
  # Global policy settings

tools:
  # Tool permission rules

resources:
  # Resource access rules

prompt_injection:
  # Prompt injection detection

exfiltration:
  # Data exfiltration prevention

rate_limits:
  # Rate limiting configuration
```

## Settings

```yaml
settings:
  default_action: deny | allow     # Default for unlisted tools (default: deny)
  require_identity: true | false   # Require valid JWT (default: true)
  log_level: debug | info | warn   # Audit log verbosity (default: info)
```

## Tool Rules

Define what MCP tools agents can use.

### Basic Pattern Matching

```yaml
tools:
  # Exact match
  - name: "search_database"
    action: allow
    
  # Wildcard pattern (matches read_file, read_database, etc.)
  - pattern: "read_*"
    action: allow
    
  # Block pattern
  - pattern: "delete_*"
    action: deny
    reason: "Deletion not permitted"
```

### Actions

| Action | Description |
|--------|-------------|
| `allow` | Permit the operation |
| `deny` | Block with reason logged |
| `log` | Allow but log for review |

### Constraints

Add conditions to allowed operations:

```yaml
tools:
  - name: "read_file"
    action: allow
    constraints:
      # Path constraints
      paths:
        allow:
          - "/data/public/**"
          - "/tmp/**"
        deny:
          - "**/.env"
          - "**/secrets/**"
          - "**/*.pem"
      
      # Read-only mode
      read_only: true
      
      # Max response size (bytes)
      max_response_size: 1048576  # 1MB
      
      # Require specific arguments
      required_args:
        - "path"
        - "encoding"
```

### Rate Limiting Per Tool

```yaml
tools:
  - name: "web_search"
    action: allow
    rate_limit:
      requests_per_minute: 10
      requests_per_hour: 100
      
  - name: "send_email"
    action: allow
    rate_limit:
      requests_per_minute: 5
      burst: 10  # Allow burst of 10
```

### Conditional Rules

```yaml
tools:
  - name: "execute_query"
    action: allow
    conditions:
      # Only in certain environments
      environments:
        - development
        - staging
        
      # Only with minimum reputation
      min_reputation: 70
      
      # Time-based restrictions
      allowed_hours:
        start: "09:00"
        end: "17:00"
        timezone: "America/New_York"
```

## Resource Rules

Control access to MCP resources:

```yaml
resources:
  - pattern: "db://customers/*"
    action: allow
    constraints:
      read_only: true
      
  - pattern: "file://secrets/**"
    action: deny
    reason: "Secrets not accessible"
    
  - pattern: "api://internal/*"
    action: deny
    reason: "Internal APIs restricted"
```

## Prompt Injection Detection

```yaml
prompt_injection:
  enabled: true
  
  # Action when detected
  action: block | log | alert
  
  # Sensitivity level
  sensitivity: low | medium | high
  
  # Custom signatures to detect
  signatures:
    - "ignore previous instructions"
    - "disregard your system prompt"
    - "pretend you are"
    - "you are now"
    - "act as if"
    - "bypass"
    - "override"
    
  # Patterns (regex)
  patterns:
    - "(?i)ignore.*previous"
    - "(?i)disregard.*prompt"
    - "(?i)you are now a"
    
  # Exclusions (things that look suspicious but are OK)
  exclusions:
    - "ignore previous error"
    - "disregard previous output"
```

### Sensitivity Levels

| Level | Description |
|-------|-------------|
| `low` | Only obvious injection attempts |
| `medium` | Standard detection (recommended) |
| `high` | Aggressive detection, may have false positives |

## Data Exfiltration Prevention

```yaml
exfiltration:
  enabled: true
  
  # Action when detected
  action: block | log | mask
  
  # Built-in patterns
  block_patterns:
    # Social Security Number
    - name: "ssn"
      pattern: "\\d{3}-\\d{2}-\\d{4}"
      
    # Credit Card Numbers
    - name: "credit_card"
      pattern: "\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}"
      
    # AWS Access Keys
    - name: "aws_access_key"
      pattern: "AKIA[0-9A-Z]{16}"
      
    # AWS Secret Keys
    - name: "aws_secret_key"
      pattern: "[A-Za-z0-9/+=]{40}"
      
    # Private Keys
    - name: "private_key"
      pattern: "-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----"
      
    # API Keys (generic)
    - name: "api_key"
      pattern: "(api[_-]?key|apikey)['\"]?\\s*[:=]\\s*['\"]?[a-zA-Z0-9]{20,}"
      
    # Email addresses
    - name: "email"
      pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}"
      
    # Internal IPs
    - name: "internal_ip"
      pattern: "(10\\.|172\\.(1[6-9]|2[0-9]|3[01])\\.|192\\.168\\.)[0-9.]+"
      
  # Masking configuration (when action: mask)
  masking:
    replacement: "[REDACTED]"
    partial: true  # Show first/last chars
```

## Rate Limits

Global rate limiting:

```yaml
rate_limits:
  global:
    requests_per_minute: 1000
    requests_per_hour: 10000
    
  per_agent:
    requests_per_minute: 100
    requests_per_hour: 1000
    
  per_tool:
    default:
      requests_per_minute: 50
    overrides:
      web_search:
        requests_per_minute: 10
      send_email:
        requests_per_minute: 5
```

## Reputation Rules

Configure behavior based on agent reputation:

```yaml
reputation:
  # Minimum score to operate
  min_score: 30
  
  # Score-based restrictions
  thresholds:
    - score: 30
      action: read_only
      
    - score: 50
      unlock:
        - write_operations
        
    - score: 70
      unlock:
        - external_api_calls
        
    - score: 85
      unlock:
        - admin_tools
```

## Complete Example

```yaml
version: "1.0"
name: "production-security-policy"
description: "Production security policy for customer support agents"

settings:
  default_action: deny
  require_identity: true
  log_level: info

tools:
  # Customer data - read only
  - pattern: "customer_*"
    action: allow
    constraints:
      read_only: true
      
  # Ticket management
  - name: "create_ticket"
    action: allow
    rate_limit:
      requests_per_minute: 30
      
  - name: "update_ticket"
    action: allow
    rate_limit:
      requests_per_minute: 60
      
  - name: "close_ticket"
    action: allow
    
  # Knowledge base
  - name: "search_kb"
    action: allow
    rate_limit:
      requests_per_minute: 100
      
  # Email - restricted
  - name: "send_email"
    action: allow
    conditions:
      min_reputation: 70
    rate_limit:
      requests_per_minute: 10
      
  # Admin operations - blocked
  - pattern: "admin_*"
    action: deny
    reason: "Admin operations require human approval"
    
  # Delete operations - blocked
  - pattern: "delete_*"
    action: deny
    reason: "Deletion requires human approval"
    
  # Execute operations - blocked
  - pattern: "exec_*"
    action: deny
    reason: "Code execution not permitted"

resources:
  - pattern: "db://customers/*"
    action: allow
    constraints:
      read_only: true
      
  - pattern: "db://internal/*"
    action: deny
    
  - pattern: "file://logs/*"
    action: allow
    constraints:
      read_only: true

prompt_injection:
  enabled: true
  action: block
  sensitivity: high
  signatures:
    - "ignore previous instructions"
    - "disregard your system prompt"
    - "you are now"
    - "act as if you have no restrictions"
    - "bypass security"

exfiltration:
  enabled: true
  action: block
  block_patterns:
    - name: "ssn"
      pattern: "\\d{3}-\\d{2}-\\d{4}"
    - name: "credit_card"
      pattern: "\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}"
    - name: "customer_email"
      pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}"
    - name: "api_key"
      pattern: "sk_live_[a-zA-Z0-9]{24,}"

rate_limits:
  per_agent:
    requests_per_minute: 100
    requests_per_hour: 2000

reputation:
  min_score: 40
  thresholds:
    - score: 50
      unlock:
        - create_ticket
    - score: 70
      unlock:
        - send_email
```

## Validation

Before deploying a policy, validate it:

```bash
# Validate locally
agentspd policies validate my-policy.yaml

# Upload and validate
agentspd policies create --file my-policy.yaml
```

Common validation errors:

| Error | Solution |
|-------|----------|
| `Invalid YAML syntax` | Check YAML formatting |
| `Unknown action` | Use `allow`, `deny`, or `log` |
| `Invalid pattern` | Check regex syntax |
| `Missing required field` | Add `version` and `name` |
