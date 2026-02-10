import { Command } from 'commander';
import ora from 'ora';
import { api } from '../api.js';
import { getConfig } from '../config.js';
import * as output from '../output.js';

export function createWorkspacesCommand(): Command {
  const workspaces = new Command('workspace')
    .alias('ws')
    .description('Manage Emotos Workspaces workspaces for secure agent collaboration');

  // ── workspace create ────────────────────────────────────────────────────

  workspaces
    .command('create')
    .description('Create a new workspace')
    .requiredOption('-n, --name <name>', 'Workspace name')
    .option('-p, --purpose <purpose>', 'Workspace purpose')
    .option('-m, --mode <mode>', 'Communication mode (live, mailbox, hybrid)', 'hybrid')
    .option('--max-participants <n>', 'Max participants', '10')
    .option('--ttl <duration>', 'Time to live (e.g. 24h, 7d)')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const spinner = ora('Creating workspace...').start();
      const result = await api.createWorkspace({
        name: options.name,
        purpose: options.purpose,
        mode: options.mode,
        maxParticipants: Number(options.maxParticipants),
        expiresAt: options.ttl ? parseTtl(options.ttl) : undefined,
      });

      if (result.error) {
        spinner.fail('Failed to create workspace');
        output.error(result.error.message);
        return;
      }

      if (options.json) {
        spinner.stop();
        output.printJson(result.data);
      } else {
        spinner.succeed('Workspace created!');
        if (result.data) {
          console.log();
          output.printKeyValue([
            ['Workspace ID', result.data.id],
            ['Name', result.data.name],
            ['Mode', result.data.mode],
            ['Status', result.data.status],
            ['Max Participants', String(result.data.maxParticipants)],
            ['Created', output.formatDate(result.data.createdAt)],
          ]);
          console.log();
          output.info('Next: Invite agents with:');
          console.log(`  ${output.highlight(`emotos workspace invite ${result.data.id} --agent-name "agent-name"`)}`);
        }
      }
    });

  // ── workspace list ──────────────────────────────────────────────────────

  workspaces
    .command('list')
    .alias('ls')
    .description('List workspaces')
    .option('--status <status>', 'Filter by status')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const spinner = ora('Fetching workspaces...').start();
      const result = await api.listWorkspaces({ status: options.status });

      if (result.error) {
        spinner.fail('Failed to fetch workspaces');
        output.error(result.error.message);
        return;
      }

      spinner.stop();

      if (options.json) {
        output.printJson(result.data);
      } else if (result.data) {
        if (result.data.items.length === 0) {
          output.info('No workspaces found');
          output.info('Create one with: emotos workspace create --name "My Workspace"');
          return;
        }
        output.heading('Workspaces');
        for (const ws of result.data.items) {
          console.log(`  ${output.bold(ws.name)} ${output.dim(`(${ws.id.slice(0, 8)}...)`)}`);
          console.log(`    Mode: ${ws.mode}  Status: ${ws.status}  Created: ${output.formatDate(ws.createdAt)}`);
        }
      }
    });

  // ── workspace invite ────────────────────────────────────────────────────

  workspaces
    .command('invite <workspaceId>')
    .description('Generate an invite token for a workspace (accepts name or ID)')
    .requiredOption('--agent-name <name>', 'Name of the agent to invite')
    .option('--email <address>', 'Send invite via email')
    .option('--expires <duration>', 'Token expiry duration (e.g. 1h, 24h)', '1h')
    .option('--max-uses <count>', 'Max number of joins allowed (0 = unlimited)', '0')
    .option('--json', 'Output as JSON')
    .action(async (workspaceIdOrName, options) => {
      let workspaceId: string;
      try { workspaceId = await api.resolveWorkspace(workspaceIdOrName); } catch (e: any) { output.error(e.message); return; }
      const spinner = ora('Generating invite...').start();
      const maxUses = parseInt(options.maxUses, 10) || 0;
      const result = await api.workspaceInvite(workspaceId, {
        agentName: options.agentName,
        expires: options.expires,
        maxUses,
      });

      if (result.error) {
        spinner.fail('Failed to generate invite');
        output.error(result.error.message);
        return;
      }

      if (options.json) {
        spinner.stop();
        output.printJson(result.data);
      } else {
        spinner.succeed('Invite token generated!');
        if (result.data) {
          const appUrl = getConfig().appUrl;
          const joinUrl = `${appUrl}/workspaces/${workspaceId}/join?token=${encodeURIComponent(result.data.inviteToken)}`;

          console.log();
          output.printKeyValue([
            ['Invite Token', result.data.inviteToken],
            ['Join URL', joinUrl],
            ['Max Uses', result.data.maxUses === 'unlimited' || result.data.maxUses === 0 ? 'Unlimited' : String(result.data.maxUses)],
          ]);
          console.log();
          output.info('Share this link to invite agents to the workspace:');
          console.log(`  ${output.highlight(joinUrl)}`);
          console.log();
          output.info('Or join via CLI:');
          console.log(`  ${output.highlight(`emotos workspace join ${workspaceId} --invite-token <token>`)}`);
        }
      }
    });

  // ── workspace join ──────────────────────────────────────────────────────

  workspaces
    .command('join <workspaceId>')
    .description('Join a workspace with an invite token (accepts name or ID)')
    .requiredOption('--invite-token <token>', 'Invite token')
    .requiredOption('--agent-id <id>', 'Your agent name or ID')
    .option('--json', 'Output as JSON')
    .action(async (workspaceIdOrName, options) => {
      let workspaceId: string;
      try { workspaceId = await api.resolveWorkspace(workspaceIdOrName); } catch (e: any) { output.error(e.message); return; }
      let agentId: string;
      try { agentId = await api.resolveAgent(options.agentId); } catch (e: any) { output.error(e.message); return; }
      const spinner = ora('Joining workspace...').start();
      const result = await api.workspaceJoin(workspaceId, {
        agentId,
        inviteToken: options.inviteToken,
      });

      if (result.error) {
        spinner.fail('Failed to join workspace');
        output.error(result.error.message);
        return;
      }

      if (options.json) {
        spinner.stop();
        output.printJson(result.data);
      } else {
        spinner.succeed('Joined workspace!');
        if (result.data) {
          output.printKeyValue([
            ['Workspace', workspaceId],
            ['Agent', result.data.agentId],
            ['Org', result.data.orgId],
            ['Joined', output.formatDate(result.data.joinedAt)],
          ]);
        }
      }
    });

  // ── workspace post ──────────────────────────────────────────────────────

  workspaces
    .command('post <workspaceId>')
    .description('Post a message to a workspace (accepts name or ID)')
    .requiredOption('--agent-id <id>', 'Sender agent name or ID')
    .requiredOption('-m, --message <text>', 'Message content')
    .option('--type <type>', 'Message type (text, artifact)', 'text')
    .option('--json', 'Output as JSON')
    .action(async (workspaceIdOrName, options) => {
      let workspaceId: string;
      try { workspaceId = await api.resolveWorkspace(workspaceIdOrName); } catch (e: any) { output.error(e.message); return; }
      let agentId: string;
      try { agentId = await api.resolveAgent(options.agentId); } catch (e: any) { output.error(e.message); return; }
      const spinner = ora('Posting message...').start();
      const result = await api.workspacePostMessage(workspaceId, {
        senderAgentId: agentId,
        type: options.type,
        content: options.message,
      });

      if (result.error) {
        spinner.fail('Failed to post message');
        output.error(result.error.message);
        return;
      }

      if (options.json) {
        spinner.stop();
        output.printJson(result.data);
      } else {
        spinner.succeed('Message posted!');
        if (result.data) {
          console.log(`  ID: ${output.dim(result.data.id)}`);
          console.log(`  Type: ${result.data.type}`);
          console.log(`  Sent: ${output.formatDate(result.data.createdAt)}`);
        }
      }
    });

  // ── workspace messages ──────────────────────────────────────────────────

  workspaces
    .command('messages <workspaceId>')
    .alias('msgs')
    .description('List messages in a workspace (accepts name or ID)')
    .option('--after <cursor>', 'Cursor for pagination')
    .option('--limit <n>', 'Number of messages', '20')
    .option('--json', 'Output as JSON')
    .action(async (workspaceIdOrName, options) => {
      let workspaceId: string;
      try { workspaceId = await api.resolveWorkspace(workspaceIdOrName); } catch (e: any) { output.error(e.message); return; }
      const spinner = ora('Fetching messages...').start();
      const result = await api.workspaceMessages(workspaceId, {
        after: options.after,
        limit: Number(options.limit),
      });

      if (result.error) {
        spinner.fail('Failed to fetch messages');
        output.error(result.error.message);
        return;
      }

      spinner.stop();

      if (options.json) {
        output.printJson(result.data);
      } else if (result.data) {
        if (result.data.items.length === 0) {
          output.info('No messages yet');
          return;
        }

        // Resolve agent names for display
        const agentIds = [...new Set(result.data.items.map((m: any) => m.senderAgentId))];
        const agentNames: Record<string, string> = {};
        for (const id of agentIds) {
          try {
            const agentResult = await api.getAgent(id);
            if (agentResult.data) agentNames[id] = agentResult.data.name;
          } catch {
            // Fall back to truncated ID
          }
        }

        output.heading('Messages');
        for (const msg of result.data.items) {
          const senderName = agentNames[msg.senderAgentId] ?? msg.senderAgentId.slice(0, 8) + '...';
          const time = output.formatDate(msg.createdAt);
          console.log(`  ${output.dim(time)} ${output.bold(senderName)} [${msg.type}]`);
          console.log(`    ${msg.content.slice(0, 200)}${msg.content.length > 200 ? '...' : ''}`);
          console.log();
        }
        if (result.data.nextCursor) {
          output.info(`More messages available. Use --after ${result.data.nextCursor}`);
        }
      }
    });

  // ── workspace leave ─────────────────────────────────────────────────────

  workspaces
    .command('leave <workspaceId>')
    .description('Leave a workspace (accepts name or ID)')
    .requiredOption('--agent-id <id>', 'Your agent name or ID')
    .action(async (workspaceIdOrName, options) => {
      let workspaceId: string;
      try { workspaceId = await api.resolveWorkspace(workspaceIdOrName); } catch (e: any) { output.error(e.message); return; }
      let agentId: string;
      try { agentId = await api.resolveAgent(options.agentId); } catch (e: any) { output.error(e.message); return; }
      const spinner = ora('Leaving workspace...').start();
      const result = await api.workspaceLeave(workspaceId, { agentId });

      if (result.error) {
        spinner.fail('Failed to leave workspace');
        output.error(result.error.message);
        return;
      }

      spinner.succeed('Left workspace');
    });

  // ── workspace close ─────────────────────────────────────────────────────

  workspaces
    .command('close <workspaceId>')
    .description('Close a workspace (accepts name or ID)')
    .option('--json', 'Output as JSON')
    .action(async (workspaceIdOrName, options) => {
      let workspaceId: string;
      try { workspaceId = await api.resolveWorkspace(workspaceIdOrName); } catch (e: any) { output.error(e.message); return; }
      const spinner = ora('Closing workspace...').start();
      const result = await api.closeWorkspace(workspaceId);

      if (result.error) {
        spinner.fail('Failed to close workspace');
        output.error(result.error.message);
        return;
      }

      if (options.json) {
        spinner.stop();
        output.printJson({ id: workspaceId, status: 'closed' });
      } else {
        spinner.succeed(`Workspace ${workspaceId} closed`);
      }
    });

  // ── workspace watch ─────────────────────────────────────────────────────

  workspaces
    .command('watch <workspaceId>')
    .description('Watch workspace activity (real-time observer stream, accepts name or ID)')
    .option('--json', 'Output events as JSON')
    .action(async (workspaceIdOrName, options) => {
      let workspaceId: string;
      try { workspaceId = await api.resolveWorkspace(workspaceIdOrName); } catch (e: any) { output.error(e.message); return; }
      output.info(`Watching workspace ${workspaceId}...`);
      output.info('Press Ctrl+C to stop\n');

      try {
        const eventSource = await api.workspaceStream(workspaceId);
        if (!eventSource) {
          output.error('Failed to connect to workspace stream');
          return;
        }

        process.stdout.write('Connected to workspace stream\n\n');

        // eventSource is already a ReadableStreamDefaultReader from api.workspaceStream()
        const reader = eventSource;
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (options.json) {
                console.log(data);
              } else {
                try {
                  const event = JSON.parse(data);
                  const time = new Date().toISOString().slice(11, 19);
                  console.log(`${output.dim(time)} ${output.bold(event.type ?? 'event')} ${JSON.stringify(event).slice(0, 100)}`);
                } catch {
                  console.log(data);
                }
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          output.error(`Stream error: ${(err as Error).message}`);
        }
      }
    });

  return workspaces;
}

// ── Policy generation commands (added to policies) ────────────────────────

export function createPolicyGenerateCommand(): Command {
  const generate = new Command('generate')
    .description('Generate a policy from natural language using AI')
    .requiredOption('--prompt <text>', 'Natural language description of the policy')
    .option('--for-workspace <id>', 'Generate for a specific workspace')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const spinner = ora('Generating policy with AI...').start();
      const result = await api.generatePolicy({
        prompt: options.prompt,
        workspaceId: options.forWorkspace,
        mode: options.forWorkspace ? 'workspace' : 'single',
      });

      if (result.error) {
        spinner.fail('Failed to generate policy');
        output.error(result.error.message);
        return;
      }

      if (options.json) {
        spinner.stop();
        output.printJson(result.data);
      } else {
        spinner.succeed('Policy generated!');
        if (result.data) {
          console.log();
          output.printKeyValue([
            ['Generation ID', result.data.id],
            ['Model', result.data.model],
            ['Valid', result.data.validationResult?.valid ? 'Yes' : 'No'],
          ]);
          console.log();
          output.heading('Generated Policy');
          console.log(result.data.generatedPolicy);
        }
      }
    });

  return generate;
}

export function createPolicyRefineCommand(): Command {
  const refine = new Command('refine')
    .description('Refine an existing policy with AI')
    .argument('<policyId>', 'Policy ID to refine')
    .requiredOption('--prompt <text>', 'Refinement instructions')
    .option('--json', 'Output as JSON')
    .action(async (policyId, options) => {
      const spinner = ora('Refining policy with AI...').start();
      const result = await api.generatePolicy({
        prompt: options.prompt,
        existingPolicyId: policyId,
        mode: 'refine',
      });

      if (result.error) {
        spinner.fail('Failed to refine policy');
        output.error(result.error.message);
        return;
      }

      if (options.json) {
        spinner.stop();
        output.printJson(result.data);
      } else {
        spinner.succeed('Policy refined!');
        if (result.data) {
          console.log();
          output.heading('Refined Policy');
          console.log(result.data.generatedPolicy);
        }
      }
    });

  return refine;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseTtl(str: string): string {
  // Return ISO date string for the expiry
  const match = str.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) return new Date(Date.now() + 86_400_000).toISOString(); // default 24h
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return new Date(Date.now() + value * (multipliers[unit] ?? 1)).toISOString();
}
