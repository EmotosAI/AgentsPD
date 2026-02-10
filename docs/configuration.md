# Configuration

The CLI stores settings in a JSON config file and can also be driven by environment variables.

## Config File

Default location:

```
~/.config/emotos/config.json
```

Example contents after login:

```json
{
  "apiUrl": "https://emotos.ai",
  "apiKey": "emotos_org_abc123...",
  "orgId": "org_abc123",
  "orgName": "My Organization"
}
```

### View Config

```bash
agentspd config list
```

### Get / Set Individual Values

```bash
agentspd config get apiUrl
agentspd config set defaultEnvironment production
agentspd config set outputFormat json
```

### Valid Config Keys

| Key | Description | Default |
|-----|-------------|---------|
| `apiUrl` | Emotos API base URL | `https://emotos.ai` |
| `defaultEnvironment` | Default environment for new agents | `development` |
| `outputFormat` | Output format: `table`, `json`, `yaml` | `table` |

### Reset to Defaults

```bash
agentspd config reset
```

### Show Config File Path

```bash
agentspd config path
```

## Environment Variables

Environment variables take precedence over config file values:

| Variable | Description | Default |
|----------|-------------|---------|
| `EMOTOS_API_URL` | API base URL | `https://emotos.ai` |
| `EMOTOS_API_KEY` | API key for authentication | -- |
| `EMOTOS_ORG_ID` | Organization ID | -- |

Example:

```bash
EMOTOS_API_URL=https://emotos.ai agentspd agents list
```

## Per-Command Overrides

Every command accepts `--api-url` to override the API endpoint for that invocation:

```bash
agentspd agents list --api-url https://emotos.ai
```

## Output Formats

Most commands accept `--json` or `--yaml` for machine-readable output:

```bash
agentspd agents list --json
agentspd policies get pol_abc123 --yaml
```

This is useful for piping into `jq`, `yq`, or other tools.

## Multi-Org via XDG_CONFIG_HOME

To maintain fully independent sessions for different organizations, set `XDG_CONFIG_HOME` to a unique directory per org. See [Authentication - Multi-Organization Workflows](./authentication.md).

## Next Steps

- [Command Reference](./commands.md) -- full command listing
- [Provider Guide](./provider-guide.md) -- deploy secure agents
