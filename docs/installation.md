# Installation

Get the Emotos CLI (`agentspd`) installed and ready in under a minute.

## Quick Install (Recommended)

```bash
curl -fsSL https://emotos.ai/v1/cli/install.sh | bash
```

This script will:
- Check for Node.js 20+
- Install the CLI globally via npm
- Display next steps

## Install via npm

```bash
npm install -g agentspd
```

## Verify Installation

```bash
agentspd --version
```

You should see the version number printed. If you get `command not found`, ensure your npm global bin directory is in your `PATH`:

```bash
export PATH="$(npm config get prefix)/bin:$PATH"
```

## Requirements

| Requirement | Version |
|-------------|---------|
| Node.js | 20 or higher |
| npm | 10 or higher (ships with Node 20) |
| OS | macOS, Linux, or Windows (WSL recommended) |

## CI / Docker

For CI pipelines or containerized environments, install non-interactively:

```bash
npm install -g agentspd --silent
agentspd auth login --api-key "$EMOTOS_API_KEY"
```

Or include in a `Dockerfile`:

```dockerfile
FROM node:20-slim
RUN npm install -g agentspd
```

## Updating

```bash
npm update -g agentspd
```

## Uninstalling

```bash
npm uninstall -g agentspd
```

## Next Steps

- [Authentication](./authentication.md) -- sign up or log in
- [Quick Start](./quickstart.md) -- get running in 5 minutes
