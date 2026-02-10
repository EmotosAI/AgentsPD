import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import ora from "ora";
import { api } from "../api.js";
import { getConfig, isAuthenticated, setConfig } from "../config.js";
import {
	type OpenClawConnectionStatus,
	type OpenClawSession,
	invokeHook,
	listSessions,
	testConnection,
} from "../openclaw-api.js";
import * as output from "../output.js";

const DEFAULT_GATEWAY_URL =
	process.env.OPENCLAW_GATEWAY_URL || "http://127.0.0.1:18789";

const OPENCLAW_CHANNELS = [
	"last",
	"whatsapp",
	"telegram",
	"discord",
	"slack",
	"signal",
	"imessage",
	"msteams",
];

// ── Default policy for openclaw init ─────────────────────────────────────────

const DEFAULT_OPENCLAW_POLICY = `version: "1.0"
name: "openclaw-agent-policy"
description: "Security policy for OpenClaw AI assistant — allows code, web, and file operations with guardrails"

settings:
  defaultAction: deny
  requireIdentity: true
  log_all_actions: true

tools:
  - pattern: "read_file"
    action: allow
    constraints: ["path must not contain .env or credentials"]
  - pattern: "write_file"
    action: allow
    constraints: ["path must not contain /etc or /sys"]
  - pattern: "list_directory"
    action: allow
  - pattern: "search_files"
    action: allow
  - pattern: "web_search"
    action: allow
  - pattern: "web_fetch"
    action: allow
    constraints: ["url must not contain internal or localhost"]
  - pattern: "execute_command"
    action: allow
    constraints:
      - "command must not contain rm -rf or sudo"
      - "command must not contain curl.*| bash"

blocked_patterns:
  - credential_exfiltration
  - prompt_injection
  - encoding_evasion
  - base64_decode_secrets

rate_limits:
  max_tool_calls_per_minute: 60
  max_file_writes_per_minute: 20
`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getGatewayConfig(): { url: string; token: string | undefined } {
	const config = getConfig();
	return {
		url: config.openclawGatewayUrl || DEFAULT_GATEWAY_URL,
		token: config.openclawToken,
	};
}

function requireGatewayConfig(): { url: string; token: string } {
	const { url, token } = getGatewayConfig();
	if (!token) {
		output.error(
			"OpenClaw Gateway not configured. Run `agentspd openclaw connect` first.",
		);
		process.exit(1);
	}
	return { url, token };
}

/**
 * Auto-join an agent to a workspace via invite+join.
 * If `agent` is provided, use it directly. Otherwise, discover the matching
 * agent from the session name pattern.
 */
async function autoJoinAgent(
	session: OpenClawSession,
	workspaceId: string,
	agent?: { id: string; name: string },
): Promise<boolean> {
	let matchingAgent = agent;
	if (!matchingAgent) {
		const agentsResult = await api.listAgents({ limit: 200 });
		matchingAgent = (agentsResult.data?.items || []).find(
			(a) =>
				a.name === `openclaw-${session.key}` ||
				a.name === `openclaw-${session.agentId || session.key}`,
		);
	}
	if (!matchingAgent) return false;

	const inviteResult = await api.workspaceInvite(workspaceId, {
		agentName: matchingAgent.name,
	});
	if (!inviteResult.data?.inviteToken) return false;

	const joinResult = await api.workspaceJoin(workspaceId, {
		agentId: matchingAgent.id,
		inviteToken: inviteResult.data.inviteToken,
	});
	return !joinResult.error;
}

// ── Command factory ──────────────────────────────────────────────────────────

export function createOpenClawCommand(): Command {
	const openclaw = new Command("openclaw")
		.alias("oc")
		.description("Manage OpenClaw Gateway integration");

	// ── openclaw init ───────────────────────────────────────────────────────

	openclaw
		.command("init")
		.description(
			"Full bootstrap: connect, create policy, register agents, sync workspaces — in one command",
		)
		.option("-u, --url <url>", "Gateway URL", DEFAULT_GATEWAY_URL)
		.option("-t, --token <token>", "Gateway auth token")
		.option(
			"-p, --policy-name <name>",
			"Policy name",
			"openclaw-agent-policy",
		)
		.option("-e, --environment <env>", "Agent environment", "production")
		.option("--json", "Output as JSON")
		.action(async (options) => {
			// Summary counters (used across steps and in final output)
			let orgName = "N/A";
			let sessions: OpenClawSession[] = [];
			let registered = 0;
			let skipped = 0;
			let wsCreated = 0;
			let wsBridged = 0;
			let wsJoined = 0;
			let policyId: string | undefined;
			const gatewayUrl = (options.url as string).replace(/\/+$/, "");

			// ── Step 1: Verify authentication ───────────────────────────
			if (!isAuthenticated()) {
				output.error(
					'Not authenticated. Run `agentspd login -k "<your-api-key>"` first.',
				);
				return;
			}

			const spinner1 = ora("Verifying authentication...").start();
			const meResult = await api.me();
			if (meResult.error) {
				spinner1.fail("Authentication check failed");
				output.error(meResult.error.message);
				return;
			}
			orgName = meResult.data?.org?.name || "N/A";
			const authLabel = meResult.data?.user?.name
				? `${meResult.data.user.name} (${orgName})`
				: orgName;
			spinner1.succeed(`Authenticated as ${authLabel}`);

			// ── Step 2: Connect to OpenClaw Gateway (idempotent) ────────
			const token =
				options.token ||
				process.env.OPENCLAW_GATEWAY_TOKEN ||
				getConfig().openclawToken;
			if (!token) {
				output.error(
					"No Gateway token found. Provide --token, set OPENCLAW_GATEWAY_TOKEN, or run `agentspd openclaw connect` first.",
				);
				return;
			}

			// Check if already connected with valid creds
			const existing = getGatewayConfig();
			let needConnect = true;
			if (existing.token && existing.url === gatewayUrl) {
				try {
					const test = await testConnection(gatewayUrl, existing.token);
					if (test.connected) {
						needConnect = false;
						sessions = test.sessions || [];
					}
				} catch {
					// Will reconnect below
				}
			}

			if (needConnect) {
				const spinner2 = ora(
					"Connecting to OpenClaw Gateway...",
				).start();
				const status = await testConnection(gatewayUrl, token);
				if (!status.connected) {
					spinner2.fail("Cannot connect to OpenClaw Gateway");
					output.error(status.error || "Unknown error");
					return;
				}
				setConfig("openclawGatewayUrl", gatewayUrl);
				setConfig("openclawToken", token);
				sessions = status.sessions || [];
				spinner2.succeed(
					`Connected to Gateway (${status.latencyMs}ms, ${sessions.length} sessions)`,
				);
			} else {
				output.success(
					`Gateway already connected (${sessions.length} sessions)`,
				);
			}

			// ── Step 3: Create default security policy (idempotent) ─────
			const policyName = options.policyName as string;
			const spinner3 = ora(
				`Creating security policy "${policyName}"...`,
			).start();

			try {
				policyId = await api.resolvePolicy(policyName);
				spinner3.succeed(
					`Policy "${policyName}" already exists — reusing`,
				);
			} catch {
				// Policy not found — create it
				const policyResult = await api.createPolicy({
					name: policyName,
					description:
						"Security policy for OpenClaw AI assistant — deny-by-default with guardrails",
					content: DEFAULT_OPENCLAW_POLICY,
				});
				if (policyResult.error) {
					spinner3.fail("Failed to create policy");
					output.error(policyResult.error.message);
					return;
				}
				policyId = policyResult.data?.id;
				if (policyId) {
					await api.activatePolicy(policyId);
				}
				spinner3.succeed(
					`Policy "${policyName}" created and activated`,
				);
			}

			// ── Step 4: Register agents (idempotent) ────────────────────
			if (sessions.length === 0) {
				output.info(
					"No active sessions on Gateway — agent registration skipped",
				);
			} else {
				const existingAgents = await api.listAgents({ limit: 200 });
				const existingNames = new Set(
					(existingAgents.data?.items || []).map((a) => a.name),
				);

				for (const session of sessions) {
					const name = `openclaw-${session.agentId || session.key || "agent"}`;

					if (existingNames.has(name)) {
						skipped++;
						continue;
					}

					const regSpinner = ora(
						`Registering "${name}"...`,
					).start();
					const result = await api.createAgent({
						name,
						description: `OpenClaw agent (session: ${session.key})`,
						environment: options.environment,
						policyId,
					});

					if (result.error) {
						regSpinner.fail(`Failed: "${name}"`);
						output.error(result.error.message);
					} else {
						regSpinner.succeed(`Registered "${name}"`);
						registered++;
					}
				}

				if (registered > 0 || skipped > 0) {
					output.success(
						`Agents: ${registered} registered, ${skipped} already existed`,
					);
				}
			}

			// ── Step 5: Sync workspaces (idempotent) ────────────────────
			if (sessions.length > 0) {
				const spinner5 = ora(
					"Bridging sessions to Emotos workspaces...",
				).start();

				const wsResult = await api.listWorkspaces({ status: "active" });
				const existingWorkspaces = wsResult.data?.items || [];
				const bridgedKeys = new Set(
					existingWorkspaces
						.filter((w: Record<string, unknown>) =>
							((w.purpose as string) || "").includes(
								"[oc-session:",
							),
						)
						.map((w: Record<string, unknown>) => {
							const match = (
								(w.purpose as string) || ""
							).match(/\[oc-session:([^\]]+)\]/);
							return match ? match[1] : "";
						})
						.filter(Boolean),
				);

				const unbridged = sessions.filter(
					(s) => !bridgedKeys.has(s.key),
				);

				// Create workspaces for unbridged sessions
				for (const session of unbridged) {
					const displayName =
						session.displayName ||
						session.key.split(":").slice(-2).join(":");
					const wsName = `oc:${displayName}`;

					const wsCreateResult = await api.createWorkspace({
						name: wsName,
						purpose: `Bridged from OpenClaw [oc-session:${session.key}] (${session.channel || "webchat"})`,
						mode: "hybrid",
						maxParticipants: 20,
					});

					if (wsCreateResult.data?.id) {
						await autoJoinAgent(session, wsCreateResult.data.id);
						wsCreated++;
					}
				}

				// Auto-join agents to existing workspaces missing them
				const allAgents =
					(await api.listAgents({ limit: 200 })).data?.items || [];
				for (const session of sessions.filter((s) =>
					bridgedKeys.has(s.key),
				)) {
					const ws = existingWorkspaces.find(
						(w: Record<string, unknown>) =>
							((w.purpose as string) || "").includes(
								`[oc-session:${session.key}]`,
							),
					) as Record<string, unknown> | undefined;
					if (!ws) continue;
					const participants =
						(ws.participants as Array<
							Record<string, unknown>
						>) || [];
					const namePatterns = [
						`openclaw-${session.key}`,
						`openclaw-${session.agentId || session.key}`,
					];
					if (
						participants.some((p) =>
							namePatterns.includes(p.agentName as string),
						)
					)
						continue;
					const matchingAgent = allAgents.find((a) =>
						namePatterns.includes(a.name),
					);
					if (!matchingAgent) continue;
					const wsId = ws.id as string;
					if (
						wsId &&
						(await autoJoinAgent(session, wsId, matchingAgent))
					) {
						wsJoined++;
					}
				}

				wsBridged = bridgedKeys.size;
				spinner5.succeed(
					`Workspaces: ${wsCreated} created, ${wsBridged} already bridged` +
						(wsJoined > 0 ? `, ${wsJoined} agents joined` : ""),
				);
			}

			// ── Step 6: Summary ─────────────────────────────────────────
			console.log();
			if (options.json) {
				output.printJson({
					authenticated: true,
					org: orgName,
					gatewayUrl,
					gatewayConnected: true,
					policy: policyName,
					policyId,
					sessions: sessions.length,
					agentsRegistered: registered,
					agentsSkipped: skipped,
					workspacesCreated: wsCreated,
					workspacesBridged: wsBridged,
					workspacesJoined: wsJoined,
				});
			} else {
				output.heading("OpenClaw Init Complete");
				output.printKeyValue([
					["Organization", orgName],
					["Gateway", gatewayUrl],
					[
						"Policy",
						`${policyName} (${policyId?.slice(0, 8) || "N/A"}...)`,
					],
					["Sessions", String(sessions.length)],
					["Agents Registered", String(registered)],
					["Agents Skipped", String(skipped)],
					[
						"Workspaces Synced",
						String(wsCreated + wsBridged),
					],
				]);
				console.log();
				output.success(
					"Bootstrap complete. Threat monitoring is active.",
				);
				console.log();
				output.info("Next commands:");
				console.log(
					`  ${output.highlight("agentspd openclaw status")}       — Integration health check`,
				);
				console.log(
					`  ${output.highlight("agentspd threats list")}          — View detected threats`,
				);
				console.log(
					`  ${output.highlight("agentspd audit events")}          — Review audit trail`,
				);
				console.log(
					`  ${output.highlight("agentspd openclaw webhook")}      — Set up threat alerting`,
				);
			}
		});

	// ── openclaw connect ─────────────────────────────────────────────────────

	openclaw
		.command("connect")
		.description("Configure and test connection to an OpenClaw Gateway")
		.option("-u, --url <url>", "Gateway URL", DEFAULT_GATEWAY_URL)
		.option("-t, --token <token>", "Gateway auth token")
		.option("--json", "Output as JSON")
		.action(async (options) => {
			let gatewayUrl: string = options.url;
			let token: string = options.token;

			// Interactive prompts if not provided via flags
			if (!token) {
				const answers = await inquirer.prompt([
					{
						type: "input",
						name: "url",
						message: "OpenClaw Gateway URL:",
						default: gatewayUrl,
						validate: (input: string) => {
							try {
								new URL(input);
								return true;
							} catch {
								return "Please enter a valid URL (e.g. http://127.0.0.1:18789)";
							}
						},
					},
					{
						type: "password",
						name: "token",
						message: "Gateway auth token (from OPENCLAW_GATEWAY_TOKEN):",
						validate: (input: string) =>
							input.length > 0 || "Token is required",
					},
				]);
				gatewayUrl = answers.url;
				token = answers.token;
			}

			// Strip trailing slash
			gatewayUrl = gatewayUrl.replace(/\/+$/, "");

			const spinner = ora("Testing connection to OpenClaw Gateway...").start();
			const status = await testConnection(gatewayUrl, token);

			if (!status.connected) {
				spinner.fail("Cannot connect to OpenClaw Gateway");
				output.error(status.error || "Unknown error");
				console.log();
				output.info("Make sure your OpenClaw Gateway is running:");
				console.log(`  ${output.highlight("openclaw gateway run")}`);
				return;
			}

			// Save config
			setConfig("openclawGatewayUrl", gatewayUrl);
			setConfig("openclawToken", token);

			if (options.json) {
				spinner.stop();
				output.printJson({
					connected: true,
					gatewayUrl,
					latencyMs: status.latencyMs,
					sessions: status.sessions?.length ?? "unknown",
				});
			} else {
				spinner.succeed("Connected to OpenClaw Gateway");
				console.log();
				output.printKeyValue([
					["Gateway URL", gatewayUrl],
					["Latency", `${status.latencyMs}ms`],
					["Sessions", String(status.sessions?.length ?? "N/A")],
				]);
				console.log();
				output.success(
					"Configuration saved. Run `agentspd openclaw status` to check health.",
				);
				console.log();
				output.info("Next steps:");
				console.log(
					`  ${output.highlight("agentspd openclaw register")}  — Register OpenClaw agents in Emotos`,
				);
				console.log(
					`  ${output.highlight("agentspd openclaw webhook")}   — Set up threat alerting`,
				);
			}
		});

	// ── openclaw register ────────────────────────────────────────────────────

	openclaw
		.command("register")
		.description("Register OpenClaw agents as Emotos agents")
		.option("-p, --policy <name>", "Policy to assign (name or UUID)")
		.option("-e, --environment <env>", "Environment", "production")
		.option("--all", "Register all discovered agents without prompting")
		.option("--json", "Output as JSON")
		.action(async (options) => {
			const { url: gatewayUrl, token } = requireGatewayConfig();

			// Step 1: List OpenClaw sessions/agents
			const spinner = ora("Discovering OpenClaw agents...").start();

			let sessions: OpenClawSession[];
			try {
				sessions = await listSessions(gatewayUrl, token);
			} catch (err) {
				spinner.fail("Failed to list OpenClaw sessions");
				output.error(err instanceof Error ? err.message : String(err));
				return;
			}

			if (!sessions || sessions.length === 0) {
				spinner.warn("No active sessions found on OpenClaw Gateway");
				output.info("Start an OpenClaw agent session first, then try again.");
				return;
			}

			spinner.succeed(`Found ${sessions.length} OpenClaw session(s)`);

			// Step 2: Resolve policy if specified
			let policyId: string | undefined;
			if (options.policy) {
				try {
					policyId = await api.resolvePolicy(options.policy);
				} catch (err) {
					output.error(err instanceof Error ? err.message : String(err));
					return;
				}
			}

			// Step 3: Select which sessions to register
			let selectedSessions = sessions;
			if (!options.all && sessions.length > 1) {
				const answers = await inquirer.prompt([
					{
						type: "checkbox",
						name: "selected",
						message: "Select agents to register:",
						choices: sessions.map((s) => ({
							name: `${s.agentId || s.key}${s.summary ? ` — ${s.summary}` : ""}`,
							value: s,
							checked: true,
						})),
						validate: (input: unknown[]) =>
							input.length > 0 || "Select at least one agent",
					},
				]);
				selectedSessions = answers.selected;
			}

			// Step 4: Register each in Emotos
			const results: Array<{
				session: string;
				agentId?: string;
				error?: string;
			}> = [];

			for (const session of selectedSessions) {
				const name = session.agentId || session.key || "openclaw-agent";
				const regSpinner = ora(`Registering "${name}"...`).start();

				const result = await api.createAgent({
					name: `openclaw-${name}`,
					description: `OpenClaw agent (session: ${session.key})`,
					environment: options.environment,
					policyId,
				});

				if (result.error) {
					regSpinner.fail(`Failed to register "${name}"`);
					results.push({ session: name, error: result.error.message });
				} else {
					regSpinner.succeed(`Registered "${name}"`);
					results.push({ session: name, agentId: result.data?.id });
				}
			}

			// Step 5: Output results
			console.log();
			if (options.json) {
				output.printJson(results);
			} else {
				output.heading("Registration Results");
				output.printTable(
					["OpenClaw Session", "Emotos Agent ID", "Status"],
					results.map((r) => [
						r.session,
						r.agentId || "—",
						r.error ? chalk.red(r.error) : chalk.green("Registered"),
					]),
				);

				const successCount = results.filter((r) => r.agentId).length;
				if (successCount > 0) {
					console.log();
					output.info("Issue JWT tokens for proxy connections:");
					for (const r of results) {
						if (r.agentId) {
							console.log(
								`  ${output.highlight(`agentspd agents token ${r.agentId}`)}`,
							);
						}
					}
				}
			}
		});

	// ── openclaw sync ────────────────────────────────────────────────────────

	openclaw
		.command("sync")
		.description("Show drift between OpenClaw and Emotos agent registrations")
		.option("--reconcile", "Automatically register new agents")
		.option("--json", "Output as JSON")
		.action(async (options) => {
			const { url: gatewayUrl, token } = requireGatewayConfig();

			const spinner = ora("Syncing agent registrations...").start();

			// Fetch both sides in parallel
			let ocSessions: OpenClawSession[];
			try {
				ocSessions = await listSessions(gatewayUrl, token);
			} catch (err) {
				spinner.fail("Failed to list OpenClaw sessions");
				output.error(err instanceof Error ? err.message : String(err));
				return;
			}

			const emotosResult = await api.listAgents({ limit: 200 });
			if (emotosResult.error) {
				spinner.fail("Failed to list Emotos agents");
				output.error(emotosResult.error.message);
				return;
			}

			spinner.succeed("Fetched agent data from both platforms");

			const emotosAgents = emotosResult.data?.items || [];
			const ocNames = new Set(
				ocSessions.map((s) => `openclaw-${s.agentId || s.key}`),
			);
			const emotosNames = new Set(emotosAgents.map((a) => a.name));

			// Compute drift
			const unregistered = [...ocNames].filter((n) => !emotosNames.has(n));
			const stale = emotosAgents.filter(
				(a) => a.name.startsWith("openclaw-") && !ocNames.has(a.name),
			);

			if (options.json) {
				output.printJson({
					openclawSessions: ocSessions.length,
					emotosAgents: emotosAgents.filter((a) =>
						a.name.startsWith("openclaw-"),
					).length,
					unregistered,
					stale: stale.map((a) => ({ id: a.id, name: a.name })),
				});
				return;
			}

			console.log();
			output.printKeyValue([
				["OpenClaw sessions", String(ocSessions.length)],
				[
					"Emotos agents (openclaw-*)",
					String(
						emotosAgents.filter((a) => a.name.startsWith("openclaw-")).length,
					),
				],
			]);
			console.log();

			if (unregistered.length === 0 && stale.length === 0) {
				output.success("All agents are in sync");
				return;
			}

			if (unregistered.length > 0) {
				output.heading("Unregistered (in OpenClaw, not in Emotos)");
				for (const name of unregistered) {
					console.log(`  ${chalk.yellow("+")} ${name}`);
				}
			}

			if (stale.length > 0) {
				output.heading("Stale (in Emotos, not in OpenClaw)");
				for (const agent of stale) {
					console.log(`  ${chalk.red("−")} ${agent.name} (${agent.id})`);
				}
			}

			if (options.reconcile && unregistered.length > 0) {
				console.log();
				const regSpinner = ora(
					`Registering ${unregistered.length} new agent(s)...`,
				).start();
				let registered = 0;

				for (const name of unregistered) {
					const result = await api.createAgent({
						name,
						description: "Auto-registered from OpenClaw sync",
						environment: "production",
					});
					if (!result.error) registered++;
				}

				regSpinner.succeed(
					`Registered ${registered}/${unregistered.length} agent(s)`,
				);
			} else if (unregistered.length > 0) {
				console.log();
				output.info("Run with --reconcile to auto-register new agents:");
				console.log(
					`  ${output.highlight("agentspd openclaw sync --reconcile")}`,
				);
			}
		});

	// ── openclaw webhook ─────────────────────────────────────────────────────

	openclaw
		.command("webhook")
		.description("Set up threat alerting through OpenClaw messaging channels")
		.option(
			"-c, --channel <channel>",
			"Delivery channel (whatsapp, telegram, discord, slack, signal, imessage, msteams)",
		)
		.option(
			"--events <events>",
			"Comma-separated events (default: threat.detected,threat.blocked)",
		)
		.option("--json", "Output as JSON")
		.action(async (options) => {
			const { url: gatewayUrl, token } = requireGatewayConfig();

			let channel: string = options.channel;
			const events: string[] = options.events
				? options.events.split(",").map((e: string) => e.trim())
				: ["threat.detected", "threat.blocked"];

			if (!channel) {
				const answers = await inquirer.prompt([
					{
						type: "list",
						name: "channel",
						message: "Which messaging channel should receive threat alerts?",
						choices: OPENCLAW_CHANNELS.map((c) => ({
							name: c === "last" ? "last (most recent channel)" : c,
							value: c,
						})),
						default: "last",
					},
				]);
				channel = answers.channel;
			}

			// Verify OpenClaw Gateway can deliver messages
			const testSpinner = ora(
				"Verifying OpenClaw message delivery...",
			).start();

			try {
				const hookResult = await invokeHook(gatewayUrl, token, {
					message:
						"[AgentsPD] Webhook bridge test — this confirms threat alerts will be delivered here.",
					channel,
				});

				if (!hookResult.ok) {
					testSpinner.fail("OpenClaw message delivery failed");
					output.error(hookResult.error || "Unknown error");
					output.info(
						"Ensure the Gateway is running and the channel is configured.",
					);
					return;
				}
				testSpinner.succeed("Test message delivered via OpenClaw");
			} catch (err) {
				testSpinner.fail("Failed to deliver test message");
				output.error(err instanceof Error ? err.message : String(err));
				return;
			}

			// Use the tools/invoke endpoint as the webhook target
			const hooksUrl = `${gatewayUrl}/tools/invoke`;

			// Register the Emotos webhook
			const spinner = ora("Creating Emotos webhook...").start();
			const result = await api.createWebhook({
				url: hooksUrl,
				events,
			});

			if (result.error) {
				spinner.fail("Failed to create webhook");
				output.error(result.error.message);
				return;
			}

			if (options.json) {
				spinner.stop();
				output.printJson({
					webhookId: result.data?.id,
					url: hooksUrl,
					events,
					channel,
				});
			} else {
				spinner.succeed("Webhook bridge created");
				console.log();
				output.printKeyValue([
					["Webhook ID", result.data?.id || "N/A"],
					["Target", hooksUrl],
					["Events", events.join(", ")],
					["Channel", channel],
				]);
				console.log();
				output.success(
					`Threat alerts will now be delivered to your ${channel === "last" ? "most recent" : channel} channel via OpenClaw.`,
				);
			}
		});

	// ── openclaw status ──────────────────────────────────────────────────────

	openclaw
		.command("status")
		.description("Show OpenClaw integration health")
		.option("--json", "Output as JSON")
		.action(async (options) => {
			const config = getConfig();
			const gatewayUrl = config.openclawGatewayUrl;
			const token = config.openclawToken;

			const configured = !!(gatewayUrl && token);

			// Connectivity
			let connectionStatus: OpenClawConnectionStatus | undefined;
			if (configured) {
				const spinner = ora("Checking OpenClaw Gateway...").start();
				connectionStatus = await testConnection(
					gatewayUrl as string,
					token as string,
				);
				if (connectionStatus.connected) {
					spinner.succeed("OpenClaw Gateway is online");
				} else {
					spinner.fail("OpenClaw Gateway is unreachable");
				}
			}

			// Emotos agents with openclaw- prefix
			const agentsResult = await api.listAgents({ limit: 200 });
			const openclawAgents = (agentsResult.data?.items || []).filter((a) =>
				a.name.startsWith("openclaw-"),
			);

			// Webhooks pointing to OpenClaw
			const webhooksResult = await api.listWebhooks();
			const gwUrl = gatewayUrl || "";
			const openclawWebhooks = (webhooksResult.data?.webhooks || []).filter(
				(w) =>
					w.url.includes("/hooks/") ||
					(gwUrl && w.url.startsWith(gwUrl)),
			);

			if (options.json) {
				output.printJson({
					configured,
					gatewayUrl: gatewayUrl || null,
					connected: connectionStatus?.connected ?? false,
					latencyMs: connectionStatus?.latencyMs ?? null,
					error: connectionStatus?.error ?? null,
					registeredAgents: openclawAgents.length,
					activeWebhooks: openclawWebhooks.length,
				});
				return;
			}

			output.heading("OpenClaw Integration Status");

			output.printKeyValue([
				["Configured", configured ? chalk.green("Yes") : chalk.red("No")],
				["Gateway URL", gatewayUrl || chalk.gray("not set")],
				[
					"Connected",
					connectionStatus?.connected
						? chalk.green("Online")
						: chalk.red("Offline"),
				],
				[
					"Latency",
					connectionStatus ? `${connectionStatus.latencyMs}ms` : "N/A",
				],
				[
					"Gateway Sessions",
					connectionStatus?.sessions
						? String(connectionStatus.sessions.length)
						: "N/A",
				],
			]);

			console.log();
			output.printKeyValue([
				["Registered Agents", String(openclawAgents.length)],
				["Active Webhooks", String(openclawWebhooks.length)],
			]);

			if (!configured) {
				console.log();
				output.info("Get started with:");
				console.log(`  ${output.highlight("agentspd openclaw connect")}`);
			} else if (openclawAgents.length === 0) {
				console.log();
				output.info("No agents registered yet. Run:");
				console.log(`  ${output.highlight("agentspd openclaw register")}`);
			}

			if (openclawAgents.length > 0) {
				console.log();
				output.heading("Registered Agents");
				output.printTable(
					["Name", "Status", "Environment", "Reputation"],
					openclawAgents.map((a) => [
						a.name,
						output.formatStatus(a.status),
						output.formatEnvironment(a.environment),
						output.formatReputation(a.reputationScore),
					]),
				);
			}

			if (openclawWebhooks.length > 0) {
				console.log();
				output.heading("Webhook Bridges");
				output.printWebhookTable(openclawWebhooks);
			}
		});

	// ── openclaw sync-sessions ──────────────────────────────────────────────

	openclaw
		.command("sync-sessions")
		.description(
			"Bridge OpenClaw sessions into Emotos workspaces for cross-org collaboration",
		)
		.option("--auto-create", "Automatically create workspaces for new sessions")
		.option(
			"-m, --mode <mode>",
			"Workspace communication mode (live, mailbox, hybrid)",
			"hybrid",
		)
		.option("--json", "Output as JSON")
		.action(async (options) => {
			const { url: gatewayUrl, token } = requireGatewayConfig();

			// Step 1: Fetch OpenClaw sessions
			const spinner = ora("Fetching OpenClaw sessions...").start();

			let sessions: OpenClawSession[];
			try {
				sessions = await listSessions(gatewayUrl, token);
			} catch (err) {
				spinner.fail("Failed to list OpenClaw sessions");
				output.error(err instanceof Error ? err.message : String(err));
				return;
			}

			if (!sessions || sessions.length === 0) {
				spinner.warn("No active sessions on OpenClaw Gateway");
				return;
			}

			spinner.succeed(`Found ${sessions.length} OpenClaw session(s)`);

			// Step 2: Fetch existing Emotos workspaces to detect what's already bridged.
			// We tag bridged workspaces by including the session key in the purpose
			// field, prefixed with [oc-session:...].
			const wsResult = await api.listWorkspaces({ status: "active" });
			const existingWorkspaces = wsResult.data?.items || [];
			const bridgedKeys = new Set(
				existingWorkspaces
					.filter((w: Record<string, unknown>) => {
						const purpose = (w.purpose as string) || "";
						return purpose.includes("[oc-session:");
					})
					.map((w: Record<string, unknown>) => {
						const purpose = (w.purpose as string) || "";
						const match = purpose.match(/\[oc-session:([^\]]+)\]/);
						return match ? match[1] : "";
					})
					.filter(Boolean),
			);

			// Step 3: Determine which sessions need workspaces
			const unbridged = sessions.filter((s) => !bridgedKeys.has(s.key));
			const alreadyBridged = sessions.filter((s) => bridgedKeys.has(s.key));

			// Step 3b: Auto-join agents to existing workspaces that are missing the matching agent
			let joined = 0;
			const agentsResult = await api.listAgents({ limit: 200 });
			const allAgents = agentsResult.data?.items || [];
			for (const session of alreadyBridged) {
				const ws = existingWorkspaces.find(
					(w: Record<string, unknown>) => {
						const purpose = (w.purpose as string) || "";
						return purpose.includes(`[oc-session:${session.key}]`);
					},
				) as Record<string, unknown> | undefined;
				if (!ws) continue;
				// Check if any participant already matches the session name pattern
				const participants = (ws.participants as Array<Record<string, unknown>>) || [];
				const namePatterns = [
					`openclaw-${session.key}`,
					`openclaw-${session.agentId || session.key}`,
				];
				const hasMatchingParticipant = participants.some((p) =>
					namePatterns.includes(p.agentName as string),
				);
				if (hasMatchingParticipant) continue;
				// Find any agent with the matching name to join
				const matchingAgent = allAgents.find(
					(a) => namePatterns.includes(a.name),
				);
				if (!matchingAgent) continue;
				const wsId = ws.id as string;
				if (wsId && (await autoJoinAgent(session, wsId, matchingAgent))) {
					joined++;
				}
			}

			if (unbridged.length === 0) {
				const msg = joined > 0
					? `All ${sessions.length} session(s) already have Emotos workspaces (${joined} agent(s) joined)`
					: `All ${sessions.length} session(s) already have Emotos workspaces`;
				output.success(msg);
				if (options.json) {
					output.printJson({
						total: sessions.length,
						bridged: alreadyBridged.length,
						created: 0,
						joined,
					});
				}
				return;
			}

			// Step 4: Prompt or auto-create
			let toCreate = unbridged;
			if (!options.autoCreate && unbridged.length > 1) {
				const answers = await inquirer.prompt([
					{
						type: "checkbox",
						name: "selected",
						message: "Select sessions to create Emotos workspaces for:",
						choices: unbridged.map((s) => ({
							name: `${s.displayName || s.key}${s.channel ? ` (${s.channel})` : ""}`,
							value: s,
							checked: true,
						})),
						validate: (input: unknown[]) =>
							input.length > 0 || "Select at least one session",
					},
				]);
				toCreate = answers.selected;
			}

			// Step 5: Create workspaces
			const results: Array<{
				sessionKey: string;
				displayName: string;
				workspaceId?: string;
				error?: string;
			}> = [];

			for (const session of toCreate) {
				const displayName =
					session.displayName || session.key.split(":").slice(-2).join(":");
				const wsName = `oc:${displayName}`;

				const wsSpinner = ora(
					`Creating workspace for "${displayName}"...`,
				).start();

				// Tag the workspace purpose with the session key for future syncs
				const wsCreateResult = await api.createWorkspace({
					name: wsName,
					purpose: `Bridged from OpenClaw [oc-session:${session.key}] (${session.channel || "webchat"})`,
					mode: options.mode,
					maxParticipants: 20,
				});

				if (wsCreateResult.error) {
					wsSpinner.fail(`Failed: "${displayName}"`);
					results.push({
						sessionKey: session.key,
						displayName,
						error: wsCreateResult.error.message,
					});
					continue;
				}

				const workspaceId = wsCreateResult.data?.id;

				// Auto-join any registered openclaw agents that match this session
				if (workspaceId) {
					await autoJoinAgent(session, workspaceId);
				}

				wsSpinner.succeed(`Created workspace for "${displayName}"`);
				results.push({
					sessionKey: session.key,
					displayName,
					workspaceId,
				});
			}

			// Step 6: Output
			console.log();
			if (options.json) {
				output.printJson({
					total: sessions.length,
					bridged: alreadyBridged.length,
					created: results.filter((r) => r.workspaceId).length,
					results,
				});
			} else {
				output.heading("Session → Workspace Bridge Results");
				output.printTable(
					["Session", "Workspace ID", "Status"],
					results.map((r) => [
						r.displayName,
						r.workspaceId?.slice(0, 8) + "..." || "—",
						r.error ? chalk.red(r.error) : chalk.green("Created"),
					]),
				);

				const created = results.filter((r) => r.workspaceId);
				if (created.length > 0) {
					console.log();
					output.info(
						"Invite agents from any org to these workspaces:",
					);
					for (const r of created) {
						console.log(
							`  ${output.highlight(`agentspd workspace invite ${r.workspaceId} --agent-name "partner-agent"`)}`,
						);
					}
					console.log();
					output.info("Or invite directly into an OpenClaw session:");
					console.log(
						`  ${output.highlight('agentspd openclaw invite-to-session <session-key> --agent-name "agent"')}`,
					);
				}
			}
		});

	// ── openclaw invite-to-session ──────────────────────────────────────────

	openclaw
		.command("invite-to-session <sessionKey>")
		.description(
			"Invite an external Emotos agent into an OpenClaw session's workspace",
		)
		.requiredOption("--agent-name <name>", "Name of the agent to invite")
		.option("--email <address>", "Send invite link via email")
		.option("--expires <duration>", "Invite token expiry (e.g. 1h, 24h)", "24h")
		.option("--max-uses <count>", "Max joins allowed (0 = unlimited)", "0")
		.option("--json", "Output as JSON")
		.action(async (sessionKey, options) => {
			// Find the Emotos workspace that's bridged to this session
			const spinner = ora("Looking up workspace for session...").start();

			const wsResult = await api.listWorkspaces();
			const workspaces = wsResult.data?.items || [];

			const workspace = workspaces.find((w: Record<string, unknown>) => {
				const purpose = (w.purpose as string) || "";
				return purpose.includes(`[oc-session:${sessionKey}]`);
			});

			if (!workspace) {
				spinner.fail("No Emotos workspace found for this session");
				output.info("Bridge the session first with:");
				console.log(
					`  ${output.highlight("agentspd openclaw sync-sessions --auto-create")}`,
				);
				return;
			}

			spinner.succeed(`Found workspace: ${workspace.name}`);

			// Generate invite
			const invSpinner = ora("Generating invite...").start();
			const maxUses = parseInt(options.maxUses, 10) || 0;
			const invResult = await api.workspaceInvite(workspace.id, {
				agentName: options.agentName,
				expires: options.expires,
				email: options.email,
				maxUses,
			});

			if (invResult.error) {
				invSpinner.fail("Failed to generate invite");
				output.error(invResult.error.message);
				return;
			}

			if (options.json) {
				invSpinner.stop();
				output.printJson({
					workspaceId: workspace.id,
					workspaceName: workspace.name,
					sessionKey,
					...invResult.data,
				});
			} else {
				invSpinner.succeed("Invite generated!");
				const config = getConfig();
				const appUrl = config.appUrl;
				const joinUrl = `${appUrl}/workspaces/${workspace.id}/join?token=${encodeURIComponent(invResult.data?.inviteToken || "")}`;

				console.log();
				output.printKeyValue([
					["Workspace", workspace.name],
					["Session", sessionKey],
					["Invite Token", invResult.data?.inviteToken || "N/A"],
					["Join URL", joinUrl],
					[
						"Max Uses",
						invResult.data?.maxUses === "unlimited" ||
						invResult.data?.maxUses === 0
							? "Unlimited"
							: String(invResult.data?.maxUses),
					],
				]);
				console.log();
				output.info(
					"Share this link with agents from any organization (OpenClaw or not):",
				);
				console.log(`  ${output.highlight(joinUrl)}`);
				console.log();
				output.info("Or join via CLI:");
				console.log(
					`  ${output.highlight(`agentspd workspace join ${workspace.id} --invite-token "${invResult.data?.inviteToken}" --agent-id <agent>`)}`,
				);
				if (options.email) {
					output.success(`Invite also sent to ${options.email}`);
				}
			}
		});

	return openclaw;
}
