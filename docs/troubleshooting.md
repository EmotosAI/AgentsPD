# Troubleshooting

Common issues and how to resolve them.

## Authentication

### "Not authenticated" / "Invalid credentials"

```
Error: Not authenticated. Please log in first.
```

**Fix:** Log in again:

```bash
agentspd auth login
```

If using an API key, verify it hasn't been rotated:

```bash
agentspd auth login --api-key <your-key>
```

### "Email not verified"

After signup you must verify your email before most operations work. Check your inbox (and spam folder) for the verification link.

### Session Expired

Session tokens last 24 hours. If you see auth errors after a long break, simply re-login:

```bash
agentspd auth login
```

## API Connection

### "Connection refused" / "ECONNREFUSED"

```
Error: connect ECONNREFUSED 127.0.0.1:3000
```

**Possible causes:**
- The Emotos API is not running (for local development)
- Wrong `--api-url`

**Fix:**

```bash
# Check your configured API URL
agentspd config get apiUrl

# Override for local dev
agentspd agents list --api-url https://emotos.ai
```

### "Network error" / Timeout

```
Error: Request timeout
```

**Fix:**
- Check your internet connection
- Verify the API URL is reachable: `curl https://emotos.ai/health`
- Try again -- transient network issues resolve on retry

## Agents

### "Agent not found"

```
Error: Agent not found
```

The agent ID may be wrong, or the agent belongs to a different organization. Verify:

```bash
agentspd agents list
```

### "API key will not be shown again"

If you lost the API key returned at agent creation, you cannot retrieve it. Rotate credentials instead:

```bash
agentspd agents rotate <agent-id>
```

## Tokens

### "TOKEN_EXPIRED"

```
Error: TOKEN_EXPIRED
```

JWT tokens are short-lived by design. Issue a new one:

```bash
agentspd agents token <agent-id> --ttl 3600
```

### "TOKEN_INVALID"

```
Error: TOKEN_INVALID
```

The token may have been issued for a different agent or environment, or it was revoked. Issue a fresh token.

## Policies

### "Invalid YAML syntax"

```
Error: Invalid YAML syntax
```

Check your YAML file for indentation errors. Validate before uploading:

```bash
agentspd policies validate my-policy.yaml
```

### "Action denied by policy"

```
Error: Action denied by policy: Shell execution blocked
```

Your security policy is blocking the requested operation. Review and update the policy if needed:

```bash
agentspd policies get <policy-id> --content
```

## Rate Limits

### "Rate limit exceeded"

```
Error: Rate limit exceeded
```

Your agent is sending requests faster than the policy allows. Solutions:
- Add delays between requests
- Increase the rate limit in your policy
- Contact support for higher limits on Pro/Business plans

## Workspaces

### "Invite token expired or usage limit reached"

Invite tokens are time-limited and have a configurable max-uses limit. Generate a new one:

```bash
agentspd workspace invite <workspace-id> --agent-name "partner"
```

### "Workspace is closed"

You cannot post messages to a closed workspace. Create a new one if collaboration needs to continue.

## CLI Not Found

### "command not found: agentspd"

```
bash: agentspd: command not found
```

**Fix:**

1. Ensure the CLI is installed: `npm list -g agentspd`
2. Add npm's global bin to your PATH:

```bash
export PATH="$(npm config get prefix)/bin:$PATH"
```

3. Or reinstall: `npm install -g agentspd`

## Getting Help

If none of the above resolves your issue:

- Run `agentspd docs` to open the documentation
- Visit the [Emotos Dashboard](https://emotos.ai/docs) for the full reference
- Contact support at support@emotos.ai
