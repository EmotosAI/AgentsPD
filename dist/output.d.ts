export type OutputFormat = 'table' | 'json' | 'yaml';
export declare function success(message: string): void;
export declare function error(message: string): void;
export declare function warn(message: string): void;
export declare function info(message: string): void;
export declare function heading(text: string): void;
export declare function dim(text: string): string;
export declare function bold(text: string): string;
export declare function link(url: string): string;
export declare function code(text: string): string;
export declare function highlight(text: string): string;
export declare function formatDate(dateStr: string): string;
export declare function formatStatus(status: string): string;
export declare function formatSeverity(severity: string): string;
export declare function formatEnvironment(env: string): string;
export declare function formatReputation(score: number): string;
export declare function printTable(headers: string[], rows: string[][]): void;
export declare function printJson(data: unknown): void;
export declare function printYaml(data: unknown): void;
export declare function print<T>(data: T, format?: OutputFormat): void;
export declare function printAgentTable(agents: Array<{
    id: string;
    name: string;
    status: string;
    environment: string;
    reputationScore: number;
    createdAt: string;
}>): void;
export declare function printPolicyTable(policies: Array<{
    id: string;
    name: string;
    version: string;
    isActive: boolean;
    createdAt: string;
}>): void;
export declare function printThreatTable(threats: Array<{
    id: string;
    agentId: string;
    threatType: string;
    severity: string;
    status: string;
    createdAt: string;
}>): void;
export declare function printAuditTable(events: Array<{
    id: string;
    agentId: string;
    eventType: string;
    timestamp: string;
}>): void;
export declare function printWebhookTable(webhooks: Array<{
    id: string;
    url: string;
    events: string[];
    createdAt: string;
}>): void;
export declare function printKeyValue(pairs: Array<[string, string | number | boolean | undefined]>): void;
export declare function printBox(title: string, content: string[]): void;
export declare function printCodeBlock(code: string, language?: string): void;
export declare function printSecret(label: string, secret: string): void;
//# sourceMappingURL=output.d.ts.map