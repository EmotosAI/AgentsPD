import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { api } from '../api.js';
import * as output from '../output.js';

export function createThreatsCommand(): Command {
  const threats = new Command('threats')
    .alias('threat')
    .description('Monitor and respond to security threats');

  threats
    .command('list')
    .alias('ls')
    .description('List detected threats')
    .option('-a, --agent <agentId>', 'Filter by agent ID')
    .option('-s, --severity <severity>', 'Filter by severity (low, medium, high, critical)')
    .option('--status <status>', 'Filter by status (detected, blocked, escalated, resolved)')
    .option('-l, --limit <n>', 'Limit results', '20')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const spinner = ora('Fetching threats...').start();
      const result = await api.listThreats({
        agentId: options.agent,
        severity: options.severity,
        status: options.status,
        limit: Number.parseInt(options.limit, 10),
      });

      if (result.error) {
        spinner.fail('Failed to fetch threats');
        output.error(result.error.message);
        return;
      }

      spinner.stop();

      if (options.json) {
        output.printJson(result.data);
      } else if (result.data) {
        if (result.data.items.length === 0) {
          output.success('No threats detected!');
          return;
        }
        output.heading(`Security Threats (${result.data.total} total)`);
        output.printThreatTable(result.data.items);
      }
    });

  threats
    .command('resolve <threatId>')
    .description('Mark a threat as resolved')
    .option('-f, --force', 'Skip confirmation')
    .action(async (threatId, options) => {
      if (!options.force) {
        const answers = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Mark threat ${threatId} as resolved?`,
            default: true,
          },
        ]);
        if (!answers.confirm) {
          output.info('Operation cancelled');
          return;
        }
      }

      const spinner = ora('Resolving threat...').start();
      const result = await api.resolveThreat(threatId);

      if (result.error) {
        spinner.fail('Failed to resolve threat');
        output.error(result.error.message);
        return;
      }

      spinner.succeed('Threat resolved');
      if (result.data) {
        output.info(`Resolved at: ${output.formatDate(result.data.resolvedAt || new Date().toISOString())}`);
      }
    });

  threats
    .command('watch')
    .description('Watch for threats in real-time')
    .option('-a, --agent <agentId>', 'Filter by agent ID')
    .option('-s, --severity <severity>', 'Minimum severity to show')
    .action(async (options) => {
      output.heading('Threat Monitor');
      output.info('Press Ctrl+C to stop');
      console.log();

      // Try SSE stream first, fall back to polling
      const streamPath = options.agent
        ? `/threats/stream?agentId=${encodeURIComponent(options.agent)}`
        : '/threats/stream';
      const reader = await api.streamEvents(streamPath);

      if (reader) {
        output.info('Connected via real-time stream');
        console.log();

        const decoder = new TextDecoder();
        let buffer = '';

        const read = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() ?? '';
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const threat = JSON.parse(line.slice(6));
                    const severityStr = output.formatSeverity(threat.severity ?? 'medium');
                    const statusStr = output.formatStatus(threat.status ?? 'detected');
                    console.log(`[${output.formatDate(threat.createdAt ?? new Date().toISOString())}] ${severityStr} ${threat.threatType ?? 'threat'} - Agent: ${threat.agentId ?? 'unknown'} - Status: ${statusStr}`);
                  } catch { /* ignore parse errors */ }
                }
              }
            }
          } catch (err) {
            if ((err as Error).name !== 'AbortError') {
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
      } else {
        // Fallback: polling every 3 seconds
        let lastSeen: string | null = null;

        const fetchThreats = async () => {
          const result = await api.listThreats({
            agentId: options.agent,
            severity: options.severity,
            limit: 10,
          });

          if (result.data && result.data.items.length > 0) {
            const newThreats = lastSeen
              ? result.data.items.filter(t => t.id !== lastSeen && new Date(t.createdAt) > new Date(lastSeen!))
              : result.data.items;

            if (newThreats.length > 0) {
              for (const threat of newThreats) {
                const severityStr = output.formatSeverity(threat.severity);
                const statusStr = output.formatStatus(threat.status);
                console.log(`[${output.formatDate(threat.createdAt)}] ${severityStr} ${threat.threatType} - Agent: ${threat.agentId} - Status: ${statusStr}`);
              }
              lastSeen = result.data.items[0].id;
            }
          }
        };

        await fetchThreats();
        const interval = setInterval(fetchThreats, 3000);

        process.on('SIGINT', () => {
          clearInterval(interval);
          console.log();
          output.info('Monitoring stopped');
          process.exit(0);
        });
      }
    });

  threats
    .command('stats')
    .description('Show threat statistics')
    .action(async () => {
      const spinner = ora('Fetching threat statistics...').start();
      
      const result = await api.listThreats({ limit: 1000 });

      if (result.error) {
        spinner.fail('Failed to fetch threats');
        output.error(result.error.message);
        return;
      }

      spinner.stop();

      if (result.data) {
        const threats = result.data.items;
        const bySeverity: Record<string, number> = {};
        const byStatus: Record<string, number> = {};
        const byType: Record<string, number> = {};

        for (const threat of threats) {
          bySeverity[threat.severity] = (bySeverity[threat.severity] || 0) + 1;
          byStatus[threat.status] = (byStatus[threat.status] || 0) + 1;
          byType[threat.threatType] = (byType[threat.threatType] || 0) + 1;
        }

        output.heading('Threat Statistics');
        output.printKeyValue([
          ['Total Threats', result.data.total],
          ['Blocked', byStatus['blocked'] || 0],
          ['Resolved', byStatus['resolved'] || 0],
        ]);

        console.log();
        output.heading('By Severity');
        const severityRows = Object.entries(bySeverity)
          .map(([sev, count]) => [output.formatSeverity(sev), String(count)]);
        output.printTable(['Severity', 'Count'], severityRows);

        console.log();
        output.heading('By Type');
        const typeRows = Object.entries(byType)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([type, count]) => [type, String(count)]);
        output.printTable(['Threat Type', 'Count'], typeRows);
      }
    });

  return threats;
}
