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

const defaults: EmotosConfig = {
	apiUrl: process.env.EMOTOS_API_URL || "https://emotos.ai",
	appUrl: process.env.EMOTOS_APP_URL || "https://emotos.ai",
	defaultEnvironment: "development",
	outputFormat: "table",
};

const schema = {
	apiUrl: { type: "string" as const },
	appUrl: { type: "string" as const },
	apiKey: { type: "string" as const },
	sessionToken: { type: "string" as const },
	orgId: { type: "string" as const },
	orgName: { type: "string" as const },
	userId: { type: "string" as const },
	userName: { type: "string" as const },
	defaultEnvironment: {
		type: "string" as const,
		enum: ["development", "staging", "production"],
	},
	outputFormat: { type: "string" as const, enum: ["table", "json", "yaml"] },
	openclawGatewayUrl: { type: "string" as const },
	openclawToken: { type: "string" as const },
};

const config = new Conf<EmotosConfig>({
	projectName: "emotos",
	defaults,
	schema,
});

export function getConfig(): EmotosConfig {
	return config.store;
}

export function setConfig<K extends keyof EmotosConfig>(
	key: K,
	value: EmotosConfig[K],
): void {
	if (value === undefined || value === null) {
		config.delete(key);
		return;
	}
	config.set(key, value);
}

export function clearConfig(): void {
	config.clear();
}

export function getApiUrl(): string {
	return config.get("apiUrl");
}

export function getApiKey(): string | undefined {
	return config.get("apiKey");
}

export function getSessionToken(): string | undefined {
	return config.get("sessionToken");
}

export function getOrgId(): string | undefined {
	return config.get("orgId");
}

export function isAuthenticated(): boolean {
	return !!(config.get("apiKey") || config.get("sessionToken"));
}

export function getAuthHeader(): Record<string, string> {
	const apiKey = config.get("apiKey");
	const sessionToken = config.get("sessionToken");

	if (apiKey) {
		return { Authorization: `Bearer ${apiKey}` };
	}
	if (sessionToken) {
		return { Authorization: `Bearer ${sessionToken}` };
	}
	return {};
}

export { config };
