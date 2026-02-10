#!/usr/bin/env node

import chalk from "chalk";
import { Command } from "commander";
import {
	createAgentsCommand,
	createAuditCommand,
	createAuthCommand,
	createConfigCommand,
	createInitCommand,
	createOpenClawCommand,
	createPoliciesCommand,
	createPolicyGenerateCommand,
	createPolicyRefineCommand,
	createThreatsCommand,
	createWebhooksCommand,
	createWorkspacesCommand,
} from "./commands/index.js";
import { getConfig, setConfig } from "./config.js";
import * as output from "./output.js";

const VERSION = "1.0.0";

const BANNER = `
${chalk.cyan("╔═══════════════════════════════════════════════════════════╗")}
${chalk.cyan("║")}  ${chalk.bold.white("EMOTOS CLI")} - Security Infrastructure for AI Agents   ${chalk.cyan("║")}
${chalk.cyan("╚═══════════════════════════════════════════════════════════╝")}
`;

const program = new Command();

program
	.name("agentspd")
	.description("Emotos CLI - Security Infrastructure for AI Agents")
	.version(VERSION)
	.option("--api-url <url>", "Override API URL")
	.option("--output-format <format>", "Output format (json, yaml, table)")
	.hook("preAction", (thisCommand: Command) => {
		const opts = thisCommand.opts();
		if (opts.apiUrl) {
			setConfig("apiUrl", opts.apiUrl);
		}
		if (opts.outputFormat) {
			setConfig("outputFormat", opts.outputFormat);
		}
	});

// Add subcommands
program.addCommand(createInitCommand());
program.addCommand(createAuthCommand());
program.addCommand(createAgentsCommand());
program.addCommand(createPoliciesCommand());
program.addCommand(createAuditCommand());
program.addCommand(createThreatsCommand());
program.addCommand(createWebhooksCommand());
program.addCommand(createConfigCommand());
program.addCommand(createWorkspacesCommand());
program.addCommand(createOpenClawCommand());

// Add generate/refine to the policies command
const policiesCmd = program.commands.find(
	(c: Command) => c.name() === "policies",
);
if (policiesCmd) {
	policiesCmd.addCommand(createPolicyGenerateCommand());
	policiesCmd.addCommand(createPolicyRefineCommand());
}

// Quick commands (shortcuts)
program
	.command("login")
	.description("Quick login (alias for auth login)")
	.option("-k, --api-key <key>", "Use API key")
	.action(async (options) => {
		const authCmd = createAuthCommand();
		const loginCmd = authCmd.commands.find(
			(c: Command) => c.name() === "login",
		);
		if (loginCmd) {
			await loginCmd.parseAsync([
				"",
				"",
				...(options.apiKey ? ["-k", options.apiKey] : []),
			]);
		}
	});

program
	.command("status")
	.description("Show authentication and system status")
	.action(async () => {
		const config = getConfig();

		output.heading("Emotos Status");

		// Auth status
		const authStatus =
			config.apiKey || config.sessionToken
				? "Authenticated"
				: "Not authenticated";
		const authColor =
			config.apiKey || config.sessionToken ? chalk.green : chalk.red;

		output.printKeyValue([
			["Auth Status", authColor(authStatus)],
			["API URL", config.apiUrl],
			["Organization", config.orgName || "N/A"],
			["User", config.userName || "N/A"],
			["Environment", config.defaultEnvironment],
		]);

		if (!config.apiKey && !config.sessionToken) {
			console.log();
			output.info("Run `agentspd auth login` to authenticate");
		}
	});

// Help command enhancements
program
	.command("docs")
	.description("Open documentation")
	.action(() => {
		const cfg = getConfig();
		const docsUrl = process.env.EMOTOS_DOCS_URL || `${cfg.apiUrl}/docs`;
		const proxyWsUrl = (process.env.EMOTOS_PROXY_URL || cfg.apiUrl).replace(
			/^http/,
			"ws",
		);

		console.log(BANNER);
		output.heading("Documentation");
		console.log(`  Full documentation: ${output.link(docsUrl)}`);
		console.log(`  API Reference: ${output.link(`${cfg.apiUrl}/docs`)}`);
		console.log();
		output.heading("Quick Start");
		console.log(
			`  1. Sign up:         ${output.highlight("agentspd auth signup")}`,
		);
		console.log(
			`  2. Create policy:   ${output.highlight("agentspd policies create")}`,
		);
		console.log(
			`  3. Register agent:  ${output.highlight("agentspd agents create")}`,
		);
		console.log(
			`  4. Issue token:     ${output.highlight("agentspd agents token <agent-id>")}`,
		);
		console.log(
			`  5. Connect to MCP:  ${output.highlight(`${proxyWsUrl}/v1/mcp`)}`,
		);
		console.log();
		output.heading("For Agent Providers");
		console.log("  - Register and manage AI agents");
		console.log("  - Define security policies");
		console.log("  - Monitor agent reputation and behavior");
		console.log();
		output.heading("For Agent Consumers");
		console.log("  - Vet and approve third-party agents");
		console.log("  - Monitor threats in real-time");
		console.log("  - Review audit logs for compliance");
	});

program
	.command("quickstart")
	.alias("tutorial")
	.description("Interactive quickstart tutorial")
	.option("--provider", "Agent provider tutorial")
	.option("--consumer", "Agent consumer tutorial")
	.action(async (options) => {
		console.log(BANNER);

		if (options.provider) {
			await providerTutorial();
		} else if (options.consumer) {
			await consumerTutorial();
		} else {
			const inquirer = await import("inquirer");
			const answers = await inquirer.default.prompt([
				{
					type: "list",
					name: "role",
					message: "Which tutorial would you like to follow?",
					choices: [
						{
							name: "Agent Provider - Build and deploy secure AI agents",
							value: "provider",
						},
						{
							name: "Agent Consumer - Protect your systems from AI agents",
							value: "consumer",
						},
					],
				},
			]);

			if (answers.role === "provider") {
				await providerTutorial();
			} else {
				await consumerTutorial();
			}
		}
	});

async function providerTutorial(): Promise<void> {
	output.heading("Agent Provider Tutorial");
	console.log("This tutorial will guide you through:");
	console.log("  1. Creating a security policy");
	console.log("  2. Registering an AI agent");
	console.log("  3. Issuing identity tokens");
	console.log("  4. Connecting to the MCP proxy");
	console.log();

	const inquirer = await import("inquirer");

	// Step 1: Check authentication
	output.heading("Step 1: Authentication");
	const config = getConfig();

	if (!config.apiKey && !config.sessionToken) {
		console.log("You need to authenticate first.");
		const answers = await inquirer.default.prompt([
			{
				type: "confirm",
				name: "signup",
				message: "Would you like to create an account now?",
				default: true,
			},
		]);

		if (answers.signup) {
			console.log();
			console.log(`Run: ${output.highlight("agentspd auth signup")}`);
			console.log("Then run this tutorial again.");
			return;
		}
	} else {
		output.success("Already authenticated");
	}

	// Step 2: Create a policy
	output.heading("Step 2: Create a Security Policy");
	console.log("Security policies define what your agents can and cannot do.");
	console.log();
	console.log("Example policy (save as my-policy.yaml):");
	console.log();
	console.log(
		chalk.gray(`version: "1.0"
name: "my-agent-policy"

settings:
  default_action: deny
  require_identity: true

tools:
  - pattern: "read_*"
    action: allow
  - pattern: "write_*"
    action: allow
    constraints:
      paths:
        allow: ["/data/**"]
        deny: ["**/.env", "**/secrets/**"]

prompt_injection:
  enabled: true
  action: block`),
	);
	console.log();
	console.log(
		`Create with: ${output.highlight("agentspd policies create --file my-policy.yaml")}`,
	);

	// Step 3: Register an agent
	output.heading("Step 3: Register Your Agent");
	console.log("Each AI agent needs a unique identity.");
	console.log();
	console.log(
		`Create with: ${output.highlight("agentspd agents create --name my-agent --environment development")}`,
	);
	console.log();
	console.log("This returns:");
	console.log("  - Agent ID: unique identifier for your agent");
	console.log("  - API Key: for authenticating API calls");
	console.log();
	output.warn("Save the API key securely - it will not be shown again!");

	// Step 4: Issue tokens
	output.heading("Step 4: Issue JWT Tokens");
	console.log("Before connecting to the MCP proxy, issue a short-lived JWT:");
	console.log();
	console.log(
		`Command: ${output.highlight("agentspd agents token <agent-id> --ttl 3600")}`,
	);
	console.log();
	console.log("The token contains:");
	console.log("  - Agent identity claims");
	console.log("  - Permissions and policy version");
	console.log("  - Reputation score");

	// Step 5: Connect to proxy
	output.heading("Step 5: Connect to MCP Proxy");
	console.log("Use the JWT token to connect your agent:");
	console.log();

	const cfg = getConfig();
	const proxyWsUrl = (process.env.EMOTOS_PROXY_URL || cfg.apiUrl).replace(
		/^http/,
		"ws",
	);

	console.log(
		chalk.gray(`const WebSocket = require('ws');

const ws = new WebSocket('${proxyWsUrl}/v1/mcp', {
  headers: {
    'Authorization': 'Bearer ' + agentToken
  }
});

ws.on('open', () => {
  console.log('Connected to Emotos MCP Proxy');
});

ws.on('message', (data) => {
  // Handle MCP messages
});`),
	);
	console.log();
	output.success("Tutorial complete!");
	console.log();
	console.log("Next steps:");
	console.log(
		`  - Monitor your agent: ${output.highlight("agentspd agents monitor <agent-id>")}`,
	);
	console.log(
		`  - Check threats: ${output.highlight("agentspd threats list")}`,
	);
	console.log(
		`  - View audit logs: ${output.highlight("agentspd audit events")}`,
	);
}

async function consumerTutorial(): Promise<void> {
	output.heading("Agent Consumer Tutorial");
	console.log("This tutorial will guide you through:");
	console.log("  1. Setting up threat monitoring");
	console.log("  2. Configuring webhooks for alerts");
	console.log("  3. Reviewing audit logs");
	console.log("  4. Responding to security incidents");
	console.log();

	const inquirer = await import("inquirer");

	// Step 1: Check authentication
	output.heading("Step 1: Authentication");
	const config = getConfig();

	if (!config.apiKey && !config.sessionToken) {
		console.log("You need to authenticate first.");
		console.log(
			`Run: ${output.highlight("agentspd auth signup")}`,
		);
		return;
	}

	output.success("Already authenticated");

	// Step 2: Configure webhooks
	output.heading("Step 2: Configure Webhook Alerts");
	console.log("Get real-time alerts when threats are detected:");
	console.log();
	console.log(`Command: ${output.highlight("agentspd webhooks create")}`);
	console.log();
	console.log("Recommended events to subscribe:");
	console.log("  - threat.detected");
	console.log("  - threat.blocked");
	console.log("  - agent.suspended");
	console.log("  - agent.reputation_changed");

	// Step 3: Monitor threats
	output.heading("Step 3: Monitor Threats");
	console.log("View current threats:");
	console.log(`  ${output.highlight("agentspd threats list")}`);
	console.log();
	console.log("Watch threats in real-time:");
	console.log(`  ${output.highlight("agentspd threats watch")}`);
	console.log();
	console.log("Filter by severity:");
	console.log(`  ${output.highlight("agentspd threats list --severity high")}`);

	// Step 4: Review audit logs
	output.heading("Step 4: Review Audit Logs");
	console.log("Query audit events for compliance:");
	console.log(
		`  ${output.highlight("agentspd audit events --start 2026-01-01")}`,
	);
	console.log();
	console.log("Export for reports:");
	console.log(
		`  ${output.highlight("agentspd audit export --output audit-report.json")}`,
	);

	// Step 5: Respond to incidents
	output.heading("Step 5: Respond to Incidents");
	console.log("When a threat is detected:");
	console.log();
	console.log("1. Review the threat details:");
	console.log(
		`   ${output.highlight("agentspd threats list --status detected")}`,
	);
	console.log();
	console.log("2. Revoke compromised agent if needed:");
	console.log(`   ${output.highlight("agentspd agents revoke <agent-id>")}`);
	console.log();
	console.log("3. Resolve the threat after investigation:");
	console.log(`   ${output.highlight("agentspd threats resolve <threat-id>")}`);
	console.log();

	output.success("Tutorial complete!");
	console.log();
	console.log("Useful commands:");
	console.log(
		`  - View all agents: ${output.highlight("agentspd agents list")}`,
	);
	console.log(
		`  - Get threat stats: ${output.highlight("agentspd threats stats")}`,
	);
	console.log(
		`  - Audit statistics: ${output.highlight("agentspd audit stats")}`,
	);
}

// Error handling
program.exitOverride();

try {
	await program.parseAsync(process.argv);
} catch (err) {
	// Handle Commander.js special exits (help, version, etc.)
	if (err instanceof Error && "code" in err) {
		const code = (err as Error & { code: string }).code;
		if (
			code === "commander.help" ||
			code === "commander.helpDisplayed" ||
			code === "commander.version"
		) {
			// Help or version was displayed, exit cleanly
			process.exit(0);
		}
	}
	// Real error
	console.error(chalk.red("Error:"), err instanceof Error ? err.message : err);
	process.exit(1);
}
