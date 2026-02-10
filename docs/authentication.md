# Authentication

Emotos supports two authentication methods: **email/password** (interactive) and **API key** (programmatic).

## Sign Up

Create a new account interactively:

```bash
agentspd auth signup
```

Or provide all fields up front:

```bash
agentspd auth signup \
  --email dev@acme.com \
  --name "Alice Developer" \
  --org-name "Acme AI"
```

All accounts start on the **free** tier with full access to agents, policies, and audit logs. Upgrade to Pro or Business via the dashboard for higher limits and advanced features.

## Log In

### With Email / Password

```bash
agentspd auth login
```

Or non-interactively:

```bash
agentspd auth login --email dev@acme.com --password "your-password"
```

### With API Key

Ideal for CI, scripts, and multi-org setups:

```bash
agentspd auth login --api-key emotos_org_abc123...
```

## Check Auth Status

```bash
agentspd auth status
```

This shows:
- Whether you are authenticated
- Your user name and email
- Your organization name and ID
- API URL in use

You can also use:

```bash
agentspd auth whoami
```

## Log Out

```bash
agentspd auth logout
```

This clears stored credentials from `~/.config/emotos/config.json`.

## Multi-Organization Workflows

If you work across multiple Emotos organizations (e.g., for demos or testing), isolate sessions using `XDG_CONFIG_HOME`:

```bash
# Org A session
export XDG_CONFIG_HOME=/tmp/org-a
agentspd auth login --api-key "$ORG_A_KEY"
agentspd agents list

# Org B session (separate terminal)
export XDG_CONFIG_HOME=/tmp/org-b
agentspd auth login --api-key "$ORG_B_KEY"
agentspd agents list
```

Each session keeps its own `config.json` with independent credentials.

## Email Verification

After signing up with email/password, you may need to verify your email before certain operations are available. Check your inbox for a verification link.

## Next Steps

- [Quick Start](./quickstart.md) -- get your first agent running
- [Configuration](./configuration.md) -- customize CLI behavior
