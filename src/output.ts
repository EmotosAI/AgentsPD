import chalk from 'chalk';
import { table } from 'table';
import YAML from 'yaml';
import { getConfig } from './config.js';

export type OutputFormat = 'table' | 'json' | 'yaml';

export function success(message: string): void {
  console.log(chalk.green('✓'), message);
}

export function error(message: string): void {
  console.error(chalk.red('✗'), message);
}

export function warn(message: string): void {
  console.log(chalk.yellow('⚠'), message);
}

export function info(message: string): void {
  console.log(chalk.blue('ℹ'), message);
}

export function heading(text: string): void {
  console.log();
  console.log(chalk.bold.underline(text));
  console.log();
}

export function dim(text: string): string {
  return chalk.dim(text);
}

export function bold(text: string): string {
  return chalk.bold(text);
}

export function link(url: string): string {
  return chalk.cyan.underline(url);
}

export function code(text: string): string {
  return chalk.bgGray.white(` ${text} `);
}

export function highlight(text: string): string {
  return chalk.cyan(text);
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString();
}

export function formatStatus(status: string): string {
  const statusColors: Record<string, (s: string) => string> = {
    active: chalk.green,
    suspended: chalk.yellow,
    revoked: chalk.red,
    detected: chalk.yellow,
    blocked: chalk.red,
    escalated: chalk.magenta,
    resolved: chalk.green,
  };
  const colorFn = statusColors[status] || chalk.white;
  return colorFn(status);
}

export function formatSeverity(severity: string): string {
  const severityColors: Record<string, (s: string) => string> = {
    low: chalk.blue,
    medium: chalk.yellow,
    high: chalk.red,
    critical: chalk.bgRed.white,
  };
  const colorFn = severityColors[severity] || chalk.white;
  return colorFn(severity.toUpperCase());
}

export function formatEnvironment(env: string): string {
  const envColors: Record<string, (s: string) => string> = {
    development: chalk.gray,
    staging: chalk.yellow,
    production: chalk.green,
  };
  const colorFn = envColors[env] || chalk.white;
  return colorFn(env);
}

export function formatReputation(score: number): string {
  if (score >= 80) return chalk.green(`${score}/100`);
  if (score >= 50) return chalk.yellow(`${score}/100`);
  return chalk.red(`${score}/100`);
}

export function printTable(headers: string[], rows: string[][]): void {
  const config = {
    border: {
      topBody: chalk.gray('─'),
      topJoin: chalk.gray('┬'),
      topLeft: chalk.gray('┌'),
      topRight: chalk.gray('┐'),
      bottomBody: chalk.gray('─'),
      bottomJoin: chalk.gray('┴'),
      bottomLeft: chalk.gray('└'),
      bottomRight: chalk.gray('┘'),
      bodyLeft: chalk.gray('│'),
      bodyRight: chalk.gray('│'),
      bodyJoin: chalk.gray('│'),
      joinBody: chalk.gray('─'),
      joinLeft: chalk.gray('├'),
      joinRight: chalk.gray('┤'),
      joinJoin: chalk.gray('┼'),
    },
  };

  const headerRow = headers.map(h => chalk.bold(h));
  const output = table([headerRow, ...rows], config);
  console.log(output);
}

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function printYaml(data: unknown): void {
  console.log(YAML.stringify(data));
}

export function print<T>(data: T, format?: OutputFormat): void {
  const outputFormat = format || getConfig().outputFormat;
  
  switch (outputFormat) {
    case 'json':
      printJson(data);
      break;
    case 'yaml':
      printYaml(data);
      break;
    default:
      // For complex objects, default to JSON
      printJson(data);
  }
}

export function printAgentTable(agents: Array<{
  id: string;
  name: string;
  status: string;
  environment: string;
  reputationScore: number;
  createdAt: string;
}>): void {
  const headers = ['ID', 'Name', 'Status', 'Environment', 'Reputation', 'Created'];
  const rows = agents.map(a => [
    a.id,
    a.name,
    formatStatus(a.status),
    formatEnvironment(a.environment),
    formatReputation(a.reputationScore),
    formatDate(a.createdAt),
  ]);
  printTable(headers, rows);
}

export function printPolicyTable(policies: Array<{
  id: string;
  name: string;
  version: string;
  isActive: boolean;
  createdAt: string;
}>): void {
  const headers = ['ID', 'Name', 'Version', 'Active', 'Created'];
  const rows = policies.map(p => [
    p.id,
    p.name,
    p.version,
    p.isActive ? chalk.green('Yes') : chalk.gray('No'),
    formatDate(p.createdAt),
  ]);
  printTable(headers, rows);
}

export function printThreatTable(threats: Array<{
  id: string;
  agentId: string;
  threatType: string;
  severity: string;
  status: string;
  createdAt: string;
}>): void {
  const headers = ['ID', 'Agent', 'Type', 'Severity', 'Status', 'Time'];
  const rows = threats.map(t => [
    t.id,
    t.agentId,
    t.threatType,
    formatSeverity(t.severity),
    formatStatus(t.status),
    formatDate(t.createdAt),
  ]);
  printTable(headers, rows);
}

export function printAuditTable(events: Array<{
  id: string;
  agentId: string;
  eventType: string;
  timestamp: string;
}>): void {
  const headers = ['ID', 'Agent', 'Event Type', 'Timestamp'];
  const rows = events.map(e => [
    e.id,
    e.agentId,
    e.eventType,
    formatDate(e.timestamp),
  ]);
  printTable(headers, rows);
}

export function printWebhookTable(webhooks: Array<{
  id: string;
  url: string;
  events: string[];
  createdAt: string;
}>): void {
  const headers = ['ID', 'URL', 'Events', 'Created'];
  const rows = webhooks.map(w => [
    w.id,
    w.url.substring(0, 40) + (w.url.length > 40 ? '...' : ''),
    w.events.join(', '),
    formatDate(w.createdAt),
  ]);
  printTable(headers, rows);
}

export function printKeyValue(pairs: Array<[string, string | number | boolean | undefined]>): void {
  for (const [key, value] of pairs) {
    if (value === undefined) continue;
    console.log(`${chalk.bold(key + ':')} ${value}`);
  }
}

export function printBox(title: string, content: string[]): void {
  const width = Math.max(title.length, ...content.map(c => c.length)) + 4;
  const line = '─'.repeat(width);
  
  console.log(chalk.gray(`┌${line}┐`));
  console.log(chalk.gray('│ ') + chalk.bold(title.padEnd(width - 2)) + chalk.gray(' │'));
  console.log(chalk.gray(`├${line}┤`));
  for (const c of content) {
    console.log(chalk.gray('│ ') + c.padEnd(width - 2) + chalk.gray(' │'));
  }
  console.log(chalk.gray(`└${line}┘`));
}

export function printCodeBlock(code: string, language?: string): void {
  console.log();
  if (language) {
    console.log(chalk.dim(`# ${language}`));
  }
  console.log(chalk.bgGray.white(code));
  console.log();
}

export function printSecret(label: string, secret: string): void {
  console.log();
  console.log(chalk.yellow('⚠ Important: Save this value securely. It will not be shown again.'));
  console.log();
  console.log(chalk.bold(label + ':'));
  console.log(chalk.bgBlack.green(` ${secret} `));
  console.log();
}
