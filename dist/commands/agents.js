import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { api } from '../api.js';
import * as output from '../output.js';
import { getConfig } from '../config.js';
export function createAgentsCommand() {
    const agents = new Command('agents')
        .alias('agent')
        .description('Manage AI agents');
    agents
        .command('create')
        .alias('register')
        .description('Register a new AI agent')
        .option('-n, --name <name>', 'Agent name')
        .option('-d, --description <desc>', 'Agent description')
        .option('-e, --environment <env>', 'Environment (development, staging, production)')
        .option('-p, --policy <policyId>', 'Policy ID to assign')
        .option('--json', 'Output as JSON')
        .action(async (options) => {
        let name = options.name;
        let description = options.description;
        let environment = options.environment;
        let policyId = options.policy;
        // Interactive prompts
        if (!name) {
            const answers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'name',
                    message: 'Agent name:',
                    validate: (input) => input.length > 0 || 'Name is required',
                },
            ]);
            name = answers.name;
        }
        if (!description) {
            const answers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'description',
                    message: 'Description (optional):',
                },
            ]);
            description = answers.description || undefined;
        }
        if (!environment) {
            const answers = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'environment',
                    message: 'Environment:',
                    choices: ['development', 'staging', 'production'],
                    default: getConfig().defaultEnvironment,
                },
            ]);
            environment = answers.environment;
        }
        const spinner = ora('Registering agent...').start();
        const result = await api.createAgent({
            name,
            description,
            environment,
            policyId,
        });
        if (result.error) {
            spinner.fail('Failed to register agent');
            output.error(result.error.message);
            return;
        }
        spinner.succeed('Agent registered successfully!');
        if (options.json) {
            output.printJson(result.data);
        }
        else if (result.data) {
            console.log();
            output.printKeyValue([
                ['Agent ID', result.data.id],
                ['Name', result.data.name],
                ['Status', result.data.status],
                ['Environment', result.data.environment],
                ['Reputation', `${result.data.reputationScore}/100`],
            ]);
            // Show the API key if returned
            const apiKey = result.data.metadata?.apiKey;
            if (apiKey && typeof apiKey === 'string') {
                output.printSecret('API Key', apiKey);
            }
            console.log();
            output.info('Next steps:');
            console.log(`  1. Issue a token: ${output.highlight(`emotos agents token ${result.data.id}`)}`);
            console.log(`  2. Connect to proxy: ${output.highlight('wss://proxy.emotos.ai/v1/mcp')}`);
        }
    });
    agents
        .command('list')
        .alias('ls')
        .description('List all agents')
        .option('-e, --environment <env>', 'Filter by environment')
        .option('-s, --status <status>', 'Filter by status (active, suspended, revoked)')
        .option('-l, --limit <n>', 'Limit results', '20')
        .option('--json', 'Output as JSON')
        .action(async (options) => {
        const spinner = ora('Fetching agents...').start();
        const result = await api.listAgents({
            environment: options.environment,
            status: options.status,
            limit: Number.parseInt(options.limit, 10),
        });
        if (result.error) {
            spinner.fail('Failed to fetch agents');
            output.error(result.error.message);
            return;
        }
        spinner.stop();
        if (options.json) {
            output.printJson(result.data);
        }
        else if (result.data) {
            if (result.data.items.length === 0) {
                output.info('No agents found');
                output.info('Create one with: emotos agents create');
                return;
            }
            output.heading(`Agents (${result.data.total} total)`);
            output.printAgentTable(result.data.items);
        }
    });
    agents
        .command('get <agentId>')
        .alias('show')
        .description('Get agent details (accepts name or ID)')
        .option('--json', 'Output as JSON')
        .action(async (agentIdOrName, options) => {
        let agentId;
        try {
            agentId = await api.resolveAgent(agentIdOrName);
        }
        catch (e) {
            output.error(e.message);
            return;
        }
        const spinner = ora('Fetching agent...').start();
        const result = await api.getAgent(agentId);
        if (result.error) {
            spinner.fail('Failed to fetch agent');
            output.error(result.error.message);
            return;
        }
        spinner.stop();
        if (options.json) {
            output.printJson(result.data);
        }
        else if (result.data) {
            output.heading(`Agent: ${result.data.name}`);
            output.printKeyValue([
                ['ID', result.data.id],
                ['Name', result.data.name],
                ['Description', result.data.description],
                ['Status', output.formatStatus(result.data.status)],
                ['Environment', output.formatEnvironment(result.data.environment)],
                ['Reputation', output.formatReputation(result.data.reputationScore)],
                ['Policy ID', result.data.policyId],
                ['Created', output.formatDate(result.data.createdAt)],
                ['Updated', result.data.updatedAt ? output.formatDate(result.data.updatedAt) : undefined],
            ]);
        }
    });
    agents
        .command('token <agentId>')
        .alias('issue-token')
        .description('Issue a JWT token for an agent (accepts name or ID)')
        .option('-t, --ttl <seconds>', 'Token TTL in seconds', '3600')
        .option('--json', 'Output as JSON')
        .action(async (agentIdOrName, options) => {
        let agentId;
        try {
            agentId = await api.resolveAgent(agentIdOrName);
        }
        catch (e) {
            output.error(e.message);
            return;
        }
        const spinner = ora('Issuing token...').start();
        const result = await api.issueToken(agentId, Number.parseInt(options.ttl, 10));
        if (result.error) {
            spinner.fail('Failed to issue token');
            output.error(result.error.message);
            return;
        }
        spinner.succeed('Token issued successfully');
        if (options.json) {
            output.printJson(result.data);
        }
        else if (result.data) {
            output.printSecret('JWT Token', result.data.token);
            output.info(`Expires: ${output.formatDate(result.data.expiresAt)}`);
            console.log();
            output.info('Usage:');
            console.log('  Connect to MCP proxy with this token:');
            console.log();
            console.log(output.highlight('  const ws = new WebSocket("wss://proxy.emotos.ai/v1/mcp", {'));
            console.log(output.highlight('    headers: { "Authorization": "Bearer <token>" }'));
            console.log(output.highlight('  });'));
        }
    });
    agents
        .command('revoke <agentId>')
        .description('Revoke an agent and all its tokens (accepts name or ID)')
        .option('-f, --force', 'Skip confirmation')
        .action(async (agentIdOrName, options) => {
        let agentId;
        try {
            agentId = await api.resolveAgent(agentIdOrName);
        }
        catch (e) {
            output.error(e.message);
            return;
        }
        if (!options.force) {
            const answers = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: `Are you sure you want to revoke agent ${agentId}? This cannot be undone.`,
                    default: false,
                },
            ]);
            if (!answers.confirm) {
                output.info('Operation cancelled');
                return;
            }
        }
        const spinner = ora('Revoking agent...').start();
        const result = await api.revokeAgent(agentId);
        if (result.error) {
            spinner.fail('Failed to revoke agent');
            output.error(result.error.message);
            return;
        }
        spinner.succeed('Agent revoked successfully');
        if (result.data) {
            output.info(`Revoked at: ${output.formatDate(result.data.revokedAt)}`);
        }
    });
    agents
        .command('rotate <agentId>')
        .description('Rotate agent credentials (accepts name or ID)')
        .option('--json', 'Output as JSON')
        .action(async (agentIdOrName, options) => {
        let agentId;
        try {
            agentId = await api.resolveAgent(agentIdOrName);
        }
        catch (e) {
            output.error(e.message);
            return;
        }
        const spinner = ora('Rotating credentials...').start();
        const result = await api.rotateCredentials(agentId);
        if (result.error) {
            spinner.fail('Failed to rotate credentials');
            output.error(result.error.message);
            return;
        }
        spinner.succeed('Credentials rotated successfully');
        if (options.json) {
            output.printJson(result.data);
        }
        else if (result.data) {
            output.printSecret('New API Key', result.data.apiKey);
            output.printSecret('New JWT Token', result.data.token);
            output.info(`Token expires: ${output.formatDate(result.data.expiresAt)}`);
        }
    });
    agents
        .command('monitor <agentId>')
        .description('Monitor agent activity in real-time (accepts name or ID)')
        .option('-l, --limit <n>', 'Number of events to show', '10')
        .action(async (agentIdOrName, options) => {
        let agentId;
        try {
            agentId = await api.resolveAgent(agentIdOrName);
        }
        catch (e) {
            output.error(e.message);
            return;
        }
        output.heading(`Monitoring agent: ${agentId}`);
        output.info('Press Ctrl+C to stop');
        console.log();
        // Try SSE stream first, fall back to polling
        const reader = await api.streamEvents(`/agents/${agentId}/stream`);
        if (reader) {
            output.info('Connected via real-time stream');
            console.log();
            const decoder = new TextDecoder();
            let buffer = '';
            const read = async () => {
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done)
                            break;
                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() ?? '';
                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                try {
                                    const event = JSON.parse(line.slice(6));
                                    const time = new Date().toISOString().slice(11, 19);
                                    console.log(`${output.dim(time)} ${output.bold(event.eventType ?? 'event')} ${JSON.stringify(event).slice(0, 120)}`);
                                }
                                catch { /* ignore parse errors */ }
                            }
                        }
                    }
                }
                catch (err) {
                    if (err.name !== 'AbortError') {
                        output.warn('Stream disconnected, falling back to polling...');
                    }
                }
            };
            read();
            process.on('SIGINT', () => {
                reader.cancel();
                console.log();
                output.info('Monitoring stopped');
                process.exit(0);
            });
        }
        else {
            // Fallback: polling every 5 seconds
            const fetchEvents = async () => {
                const result = await api.queryAuditEvents({
                    agentId,
                    limit: Number.parseInt(options.limit, 10),
                });
                if (result.data && result.data.items.length > 0) {
                    output.printAuditTable(result.data.items);
                }
                else {
                    output.dim('No recent events');
                }
            };
            await fetchEvents();
            const interval = setInterval(fetchEvents, 5000);
            process.on('SIGINT', () => {
                clearInterval(interval);
                console.log();
                output.info('Monitoring stopped');
                process.exit(0);
            });
        }
    });
    return agents;
}
