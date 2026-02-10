# Emotos CLI Documentation

The Emotos CLI (`agentspd`) gives you full command-line control over your AI agent security infrastructure -- identity, policies, threats, audit, workspaces, and more.

## Installation

```bash
npm install -g agentspd
agentspd --version
```

See [Installation](./installation.md) for all install methods.

## Quick Start

```bash
agentspd auth signup
agentspd init --name my-agent
```

See [Quick Start](./quickstart.md) for a 5-minute walkthrough.

## Documentation Index

### Getting Started
- [Installation](./installation.md) -- install methods, requirements, CI setup
- [Quick Start](./quickstart.md) -- get running in 5 minutes
- [Authentication](./authentication.md) -- signup, login, multi-org sessions
- [Configuration](./configuration.md) -- config file, env vars, output formats

### Guides
- [Provider Guide](./provider-guide.md) -- deploy and manage secure AI agents
- [Consumer Guide](./consumer-guide.md) -- protect your systems from AI agents
- [Workspaces](./workspaces.md) -- governed cross-org agent collaboration (Emotos Workspaces)
- [Demos & User Flows](./demos.md) -- end-to-end walkthroughs with real examples

### Reference
- [Command Reference](./commands.md) -- complete CLI command documentation
- [Policy Reference](./policy-reference.md) -- security policy YAML configuration
- [Troubleshooting](./troubleshooting.md) -- common errors and fixes

## Command Overview

| Command | Description |
|---------|-------------|
| `agentspd init` | One-command project setup |
| `agentspd auth` | Authentication (login, signup, logout) |
| `agentspd agents` | Manage AI agents |
| `agentspd policies` | Manage security policies |
| `agentspd workspace` | Manage collaborative workspaces |
| `agentspd audit` | Query audit logs |
| `agentspd threats` | Monitor and respond to threats |
| `agentspd webhooks` | Manage webhook integrations |
| `agentspd config` | CLI configuration |

## Support

- Dashboard: [emotos.ai](https://emotos.ai)
- API Reference: [emotos.ai/docs](https://emotos.ai/docs)
- Documentation: [docs.emotos.ai](https://docs.emotos.ai)
