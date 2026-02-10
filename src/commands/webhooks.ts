import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { api } from '../api.js';
import * as output from '../output.js';

const AVAILABLE_EVENTS = [
  'agent.created',
  'agent.revoked',
  'agent.suspended',
  'agent.reputation_changed',
  'threat.detected',
  'threat.blocked',
  'threat.escalated',
  'threat.resolved',
  'policy.updated',
  'policy.activated',
  'audit.high_volume',
];

export function createWebhooksCommand(): Command {
  const webhooks = new Command('webhooks')
    .alias('webhook')
    .description('Manage webhook integrations');

  webhooks
    .command('create')
    .alias('add')
    .description('Create a new webhook')
    .option('-u, --url <url>', 'Webhook URL')
    .option('-e, --events <events>', 'Comma-separated list of events')
    .option('-s, --secret <secret>', 'Webhook secret for signature verification')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      let url = options.url;
      let events: string[] = options.events ? options.events.split(',') : [];
      let secret = options.secret;

      // Interactive prompts
      if (!url) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'url',
            message: 'Webhook URL:',
            validate: (input: string) => {
              try {
                new URL(input);
                return true;
              } catch {
                return 'Please enter a valid URL';
              }
            },
          },
        ]);
        url = answers.url;
      }

      if (events.length === 0) {
        const answers = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'events',
            message: 'Select events to subscribe to:',
            choices: AVAILABLE_EVENTS.map(e => ({
              name: e,
              checked: e.startsWith('threat.'),
            })),
            validate: (input: string[]) => input.length > 0 || 'Select at least one event',
          },
        ]);
        events = answers.events;
      }

      if (!secret) {
        const answers = await inquirer.prompt([
          {
            type: 'password',
            name: 'secret',
            message: 'Webhook secret (optional, for signature verification):',
            mask: '*',
          },
        ]);
        secret = answers.secret || undefined;
      }

      const spinner = ora('Creating webhook...').start();
      const result = await api.createWebhook({ url, events, secret });

      if (result.error) {
        spinner.fail('Failed to create webhook');
        output.error(result.error.message);
        return;
      }

      if (options.json) {
        spinner.stop();
        output.printJson(result.data);
      } else {
        spinner.succeed('Webhook created successfully!');
        if (result.data) {
          console.log();
          output.printKeyValue([
            ['Webhook ID', result.data.id],
            ['URL', result.data.url],
            ['Events', result.data.events.join(', ')],
            ['Created', output.formatDate(result.data.createdAt)],
          ]);

          console.log();
          output.info('Webhook payload example:');
          output.printJson({
            id: 'evt_123',
            type: 'threat.blocked',
            timestamp: new Date().toISOString(),
            data: {
              agentId: 'agent_abc',
              threatType: 'prompt_injection',
              severity: 'high',
            },
          });
        }
      }
    });

  webhooks
    .command('list')
    .alias('ls')
    .description('List all webhooks')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const spinner = ora('Fetching webhooks...').start();
      const result = await api.listWebhooks();

      if (result.error) {
        spinner.fail('Failed to fetch webhooks');
        output.error(result.error.message);
        return;
      }

      spinner.stop();

      if (options.json) {
        output.printJson(result.data);
      } else if (result.data) {
        if (result.data.webhooks.length === 0) {
          output.info('No webhooks configured');
          output.info('Create one with: emotos webhooks create');
          return;
        }
        output.heading('Webhooks');
        output.printWebhookTable(result.data.webhooks);
      }
    });

  webhooks
    .command('delete <webhookId>')
    .alias('rm')
    .description('Delete a webhook')
    .option('-f, --force', 'Skip confirmation')
    .action(async (webhookId, options) => {
      if (!options.force) {
        const answers = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Delete webhook ${webhookId}?`,
            default: false,
          },
        ]);
        if (!answers.confirm) {
          output.info('Operation cancelled');
          return;
        }
      }

      const spinner = ora('Deleting webhook...').start();
      const result = await api.deleteWebhook(webhookId);

      if (result.error) {
        spinner.fail('Failed to delete webhook');
        output.error(result.error.message);
        return;
      }

      spinner.succeed('Webhook deleted');
    });

  webhooks
    .command('test <webhookId>')
    .description('Send a test webhook')
    .action(async (webhookId) => {
      const spinner = ora('Sending test webhook...').start();
      const result = await api.testWebhook(webhookId);

      if (result.error) {
        spinner.fail('Failed to send test webhook');
        output.error(result.error.message);
        return;
      }

      if (result.data?.success) {
        spinner.succeed('Test webhook sent successfully!');
        output.info(`Response status: ${result.data.statusCode}`);
      } else {
        spinner.fail('Test webhook failed');
        if (result.data?.error) {
          output.error(result.data.error);
        }
      }
    });

  webhooks
    .command('events')
    .description('List available webhook events')
    .action(() => {
      output.heading('Available Webhook Events');
      
      const agentEvents = AVAILABLE_EVENTS.filter(e => e.startsWith('agent.'));
      const threatEvents = AVAILABLE_EVENTS.filter(e => e.startsWith('threat.'));
      const policyEvents = AVAILABLE_EVENTS.filter(e => e.startsWith('policy.'));
      const auditEvents = AVAILABLE_EVENTS.filter(e => e.startsWith('audit.'));

      console.log(output.bold('Agent Events'));
      for (const event of agentEvents) {
        console.log(`  - ${event}`);
      }
      
      console.log();
      console.log(output.bold('Threat Events'));
      for (const event of threatEvents) {
        console.log(`  - ${event}`);
      }

      console.log();
      console.log(output.bold('Policy Events'));
      for (const event of policyEvents) {
        console.log(`  - ${event}`);
      }

      console.log();
      console.log(output.bold('Audit Events'));
      for (const event of auditEvents) {
        console.log(`  - ${event}`);
      }
    });

  return webhooks;
}
