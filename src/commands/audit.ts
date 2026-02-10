import { Command } from 'commander';
import ora from 'ora';
import { api } from '../api.js';
import * as output from '../output.js';

export function createAuditCommand(): Command {
  const audit = new Command('audit')
    .description('Query audit logs');

  audit
    .command('events')
    .alias('list')
    .description('Query audit events')
    .option('-a, --agent <agentId>', 'Filter by agent ID')
    .option('-t, --type <eventType>', 'Filter by event type')
    .option('--start <date>', 'Start time (ISO 8601)')
    .option('--end <date>', 'End time (ISO 8601)')
    .option('-l, --limit <n>', 'Limit results', '50')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const spinner = ora('Fetching audit events...').start();
      const result = await api.queryAuditEvents({
        agentId: options.agent,
        eventType: options.type,
        startTime: options.start,
        endTime: options.end,
        limit: Number.parseInt(options.limit, 10),
      });

      if (result.error) {
        spinner.fail('Failed to fetch audit events');
        output.error(result.error.message);
        return;
      }

      spinner.stop();

      if (options.json) {
        output.printJson(result.data);
      } else if (result.data) {
        if (result.data.items.length === 0) {
          output.info('No audit events found');
          return;
        }
        output.heading(`Audit Events (${result.data.total} total)`);
        output.printAuditTable(result.data.items);
      }
    });

  audit
    .command('get <eventId>')
    .alias('show')
    .description('Get audit event details')
    .option('--json', 'Output as JSON')
    .action(async (eventId, options) => {
      const spinner = ora('Fetching audit event...').start();
      const result = await api.getAuditEvent(eventId);

      if (result.error) {
        spinner.fail('Failed to fetch audit event');
        output.error(result.error.message);
        return;
      }

      spinner.stop();

      if (options.json) {
        output.printJson(result.data);
      } else if (result.data) {
        output.heading('Audit Event');
        output.printKeyValue([
          ['ID', result.data.id],
          ['Agent ID', result.data.agentId],
          ['Event Type', result.data.eventType],
          ['Timestamp', output.formatDate(result.data.timestamp)],
          ['Signature', result.data.signature ? 'Verified' : 'Not signed'],
        ]);

        if (result.data.requestData) {
          console.log();
          output.heading('Request Data');
          output.printJson(result.data.requestData);
        }

        if (result.data.responseData) {
          console.log();
          output.heading('Response Data');
          output.printJson(result.data.responseData);
        }
      }
    });

  audit
    .command('export')
    .description('Export audit events to file')
    .option('-a, --agent <agentId>', 'Filter by agent ID')
    .option('--start <date>', 'Start time (ISO 8601)')
    .option('--end <date>', 'End time (ISO 8601)')
    .option('-o, --output <path>', 'Output file path', 'audit-export.json')
    .option('-f, --format <format>', 'Output format (json, csv)', 'json')
    .action(async (options) => {
      const spinner = ora('Exporting audit events...').start();
      
      let allEvents: unknown[] = [];
      let cursor: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const result = await api.queryAuditEvents({
          agentId: options.agent,
          startTime: options.start,
          endTime: options.end,
          limit: 100,
        });

        if (result.error) {
          spinner.fail('Failed to export audit events');
          output.error(result.error.message);
          return;
        }

        if (result.data) {
          allEvents = [...allEvents, ...result.data.items];
          hasMore = result.data.hasMore;
          cursor = result.data.cursor;
          spinner.text = `Exporting audit events... (${allEvents.length} events)`;
        } else {
          hasMore = false;
        }
      }

      // Write to file
      const fs = await import('node:fs');
      
      if (options.format === 'csv') {
        const events = allEvents as Array<{ id: string; agentId: string; eventType: string; timestamp: string }>;
        const csv = [
          'id,agentId,eventType,timestamp',
          ...events.map(e => `${e.id},${e.agentId},${e.eventType},${e.timestamp}`),
        ].join('\n');
        fs.writeFileSync(options.output, csv);
      } else {
        fs.writeFileSync(options.output, JSON.stringify(allEvents, null, 2));
      }

      spinner.succeed(`Exported ${allEvents.length} events to ${options.output}`);
    });

  audit
    .command('stats')
    .description('Show audit statistics')
    .option('--start <date>', 'Start time (ISO 8601)')
    .option('--end <date>', 'End time (ISO 8601)')
    .action(async (options) => {
      const spinner = ora('Calculating statistics...').start();
      
      const result = await api.queryAuditEvents({
        startTime: options.start,
        endTime: options.end,
        limit: 1000,
      });

      if (result.error) {
        spinner.fail('Failed to fetch audit events');
        output.error(result.error.message);
        return;
      }

      spinner.stop();

      if (result.data) {
        const events = result.data.items;
        const byType: Record<string, number> = {};
        const byAgent: Record<string, number> = {};

        for (const event of events) {
          byType[event.eventType] = (byType[event.eventType] || 0) + 1;
          byAgent[event.agentId] = (byAgent[event.agentId] || 0) + 1;
        }

        output.heading('Audit Statistics');
        output.printKeyValue([
          ['Total Events', result.data.total],
          ['Unique Event Types', Object.keys(byType).length],
          ['Unique Agents', Object.keys(byAgent).length],
        ]);

        console.log();
        output.heading('Events by Type');
        const typeRows = Object.entries(byType)
          .sort((a, b) => b[1] - a[1])
          .map(([type, count]) => [type, String(count)]);
        output.printTable(['Event Type', 'Count'], typeRows);

        console.log();
        output.heading('Events by Agent');
        const agentRows = Object.entries(byAgent)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([agent, count]) => [agent, String(count)]);
        output.printTable(['Agent ID', 'Count'], agentRows);
      }
    });

  return audit;
}
