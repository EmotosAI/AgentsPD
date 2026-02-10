# Emotos CLI (`agentspd`)

Command-line interface for the Emotos security platform. Manage AI agent identities, security policies, workspaces, audit logs, and more.

**Public repo**: [github.com/EmotosAI/AgentsPD](https://github.com/EmotosAI/AgentsPD) (MIT)
**npm**: [`agentspd`](https://www.npmjs.com/package/agentspd)
**ClawHub**: `clawhub install agentspd`

## Install

```bash
curl -fsSL https://emotos.ai/v1/cli/install.sh | bash
```

Or via npm:

```bash
npm install -g agentspd
```

Requires **Node.js 20+**.

> **OpenClaw users**: Install the skill via `clawhub install agentspd` for seamless integration. See [SKILL.md](./SKILL.md) for the skill definition.

## Quick Start

The fastest way to get going -- authenticate, create a policy (with AI or from a template), register an agent, and issue a token in one step:

```bash
agentspd init
```

Or step by step:

```bash
# Sign up (no role selection needed -- defaults to free tier)
agentspd auth signup

# Create a policy -- AI generates one from your description, or use a YAML file
agentspd policies create --name "My Policy"

# Register an agent
agentspd agents create --name "my-agent" --environment production

# Issue a JWT token (accepts agent name or UUID)
agentspd agents token my-agent --ttl 3600
```

> **Name-based resolution**: All commands that accept an ID also accept a human-readable name. For example, `agentspd agents get my-agent` works the same as `agentspd agents get <uuid>`.

## Documentation

Comprehensive guides and reference:

| Document | Description |
|----------|-------------|
| Document | Link |
|----------|------|
| **Full Documentation** | [docs.emotos.ai](https://docs.emotos.ai) |
| **Dashboard** | [emotos.ai](https://emotos.ai) |
| **API Reference** | [emotos.ai/docs/api](https://emotos.ai/docs/api) |
| **OpenClaw Integration** | See [SKILL.md](./SKILL.md) |

## Key Features

- **AI Policy Generation** -- describe what your agent does in plain English and get a production-ready YAML security policy
- **Name-Based Resolution** -- use human-readable names (e.g. `my-agent`, `production-policy`) instead of UUIDs in every command
- **Real-Time Monitoring** -- SSE-powered live streams for agent activity (`agents monitor`) and threat detection (`threats watch`)
- **Email Invites** -- send workspace invitations via email with a one-click join URL
- **Dashboard Join URLs** -- every workspace invite includes a direct link to the dashboard join page

## Commands at a Glance

| Command | Description |
|---------|-------------|
| `agentspd init` | One-command project setup with AI policy generation |
| `agentspd auth` | Authentication (signup, login, logout) |
| `agentspd agents` | Manage AI agents (name or UUID) |
| `agentspd policies` | Manage security policies (AI generate or YAML) |
| `agentspd workspace` | Collaborative workspaces with email invites |
| `agentspd audit` | Query audit logs |
| `agentspd threats` | Monitor threats (real-time SSE) |
| `agentspd webhooks` | Manage webhooks |
| `agentspd openclaw` | OpenClaw integration (connect, register, sync, webhook, status) |
| `agentspd config` | CLI configuration |

## Global Options

| Option | Description |
|--------|-------------|
| `--api-url <url>` | Override API URL |
| `--json` | Output in JSON format |
| `--yaml` | Output in YAML format |
| `--version` | Show version number |
| `--help` | Show help |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `EMOTOS_API_URL` | API base URL (default: `https://emotos.ai`) |
| `EMOTOS_API_KEY` | API key for authentication |
| `EMOTOS_ORG_ID` | Organization ID |

## Publishing

This package is automatically published to npm and ClawHub via GitHub Actions when changes are pushed to `main`.

To release a new version:
1. Update the `version` field in `package.json`
2. Commit and push to `main`
3. The publish workflow will automatically build and publish to npm and ClawHub

## License

MIT — see the public repo [LICENSE](https://github.com/EmotosAI/AgentsPD/blob/main/LICENSE).
