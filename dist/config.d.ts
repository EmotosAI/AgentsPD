import Conf from "conf";
export interface EmotosConfig {
    apiUrl: string;
    appUrl: string;
    apiKey?: string;
    sessionToken?: string;
    orgId?: string;
    orgName?: string;
    userId?: string;
    userName?: string;
    defaultEnvironment: "development" | "staging" | "production";
    outputFormat: "table" | "json" | "yaml";
    openclawGatewayUrl?: string;
    openclawToken?: string;
}
declare const config: Conf<EmotosConfig>;
export declare function getConfig(): EmotosConfig;
export declare function setConfig<K extends keyof EmotosConfig>(key: K, value: EmotosConfig[K]): void;
export declare function clearConfig(): void;
export declare function getApiUrl(): string;
export declare function getApiKey(): string | undefined;
export declare function getSessionToken(): string | undefined;
export declare function getOrgId(): string | undefined;
export declare function isAuthenticated(): boolean;
export declare function getAuthHeader(): Record<string, string>;
export { config };
//# sourceMappingURL=config.d.ts.map