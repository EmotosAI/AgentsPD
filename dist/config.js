import Conf from "conf";
const defaults = {
    apiUrl: process.env.EMOTOS_API_URL || "https://emotos.ai",
    appUrl: process.env.EMOTOS_APP_URL || "https://emotos.ai",
    defaultEnvironment: "development",
    outputFormat: "table",
};
const schema = {
    apiUrl: { type: "string" },
    appUrl: { type: "string" },
    apiKey: { type: "string" },
    sessionToken: { type: "string" },
    orgId: { type: "string" },
    orgName: { type: "string" },
    userId: { type: "string" },
    userName: { type: "string" },
    defaultEnvironment: {
        type: "string",
        enum: ["development", "staging", "production"],
    },
    outputFormat: { type: "string", enum: ["table", "json", "yaml"] },
    openclawGatewayUrl: { type: "string" },
    openclawToken: { type: "string" },
};
const config = new Conf({
    projectName: "emotos",
    defaults,
    schema,
});
export function getConfig() {
    return config.store;
}
export function setConfig(key, value) {
    if (value === undefined || value === null) {
        config.delete(key);
        return;
    }
    config.set(key, value);
}
export function clearConfig() {
    config.clear();
}
export function getApiUrl() {
    return config.get("apiUrl");
}
export function getApiKey() {
    return config.get("apiKey");
}
export function getSessionToken() {
    return config.get("sessionToken");
}
export function getOrgId() {
    return config.get("orgId");
}
export function isAuthenticated() {
    return !!(config.get("apiKey") || config.get("sessionToken"));
}
export function getAuthHeader() {
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
