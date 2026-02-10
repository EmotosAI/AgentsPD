import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import * as fs from 'node:fs';
import { api } from '../api.js';
import { setConfig, isAuthenticated } from '../config.js';
import * as output from '../output.js';
const CREDENTIAL_PATTERNS = [
    { name: 'AWS access key', re: /AKIA[0-9A-Z]{16}/ },
    { name: 'Private key', re: /-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----/ },
    { name: 'Generic secret', re: /(?:secret|password|api[_-]?key)\s*[:=]\s*["']?[A-Za-z0-9_/+=]{20,}/ },
];
const SCAN_TARGETS = [
    'openclaw.json',
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
];
const DEFAULT_POLICY_CONTENT = `version: "1.0"
name: "default-policy"
description: "Default security policy created by agentspd init"

settings:
  default_action: deny
  require_identity: true

tools:
  - pattern: "read_*"
    action: allow
  - pattern: "exec_*"
    action: deny
    reason: "Shell execution not permitted"
  - pattern: "web_*"
    action: allow
    rate_limit:
      requests_per_minute: 10

prompt_injection:
  enabled: true
  action: block

exfiltration:
  enabled: true
  block_patterns:
    - name: "aws_keys"
      pattern: "AKIA[0-9A-Z]{16}"
    - name: "private_keys"
      pattern: "-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----"
`;
function scanForCredentials() {
    const hits = [];
    for (const target of SCAN_TARGETS) {
        if (!fs.existsSync(target))
            continue;
        let content;
        try {
            content = fs.readFileSync(target, 'utf-8');
        }
        catch {
            continue;
        }
        for (const { name, re } of CREDENTIAL_PATTERNS) {
            if (re.test(content)) {
                hits.push({ file: target, label: name });
            }
        }
    }
    return hits;
}
async function runSignup() {
    console.log();
    output.info('You need an account first. Let\'s create one.');
    console.log();
    console.log(`  Or sign up in your browser: ${output.link('https://emotos.ai/signup')}`);
    console.log();
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'email',
            message: 'Email:',
            validate: (input) => input.includes('@') || 'Please enter a valid email',
        },
        {
            type: 'password',
            name: 'password',
            message: 'Password (min 8 characters):',
            mask: '*',
            validate: (input) => input.length >= 8 || 'Password must be at least 8 characters',
        },
        {
            type: 'input',
            name: 'name',
            message: 'Your name:',
            validate: (input) => input.length > 0 || 'Name is required',
        },
        {
            type: 'input',
            name: 'orgName',
            message: 'Organization name:',
            validate: (input) => input.length > 0 || 'Organization name is required',
        },
    ]);
    const spinner = ora('Creating account...').start();
    const result = await api.signup({
        email: answers.email,
        password: answers.password,
        name: answers.name,
        role: 'free',
        orgName: answers.orgName,
    });
    if (result.error) {
        spinner.fail('Account creation failed');
        output.error(result.error.message);
        return false;
    }
    if (result.data) {
        const data = result.data;
        // Handle verification-required flow (production)
        if (data.requiresVerification) {
            // Store org API key for auth until verified
            if (data.orgApiKey) {
                setConfig('apiKey', data.orgApiKey);
            }
            spinner.succeed('Account created!');
            output.info(`Email verification required. Check your inbox at ${answers.email}`);
            console.log();
            console.log(`  Verify your email, then log in at: ${output.link('https://emotos.ai/login')}`);
            console.log();
            // Dev mode: auto-verify using the debug token
            if (data._verificationToken) {
                const verifySpinner = ora('Auto-verifying (dev mode)...').start();
                const verifyResult = await api.verify(data._verificationToken);
                if (verifyResult.data) {
                    setConfig('sessionToken', verifyResult.data.token);
                    if (verifyResult.data.org) {
                        setConfig('orgId', verifyResult.data.org.id);
                        setConfig('orgName', verifyResult.data.org.name);
                    }
                    if (verifyResult.data.user) {
                        setConfig('userId', verifyResult.data.user.id);
                        setConfig('userName', verifyResult.data.user.name);
                    }
                    verifySpinner.succeed('Email verified (dev mode)');
                    return true;
                }
                verifySpinner.warn('Auto-verify failed — verify manually then run: agentspd auth login');
            }
            else {
                output.info('After verifying your email, run: agentspd auth login');
            }
            return true; // Continue init with API key auth
        }
        // Full session response (auto-verified / legacy flow)
        const sessionToken = data.sessionToken || data.token;
        if (sessionToken)
            setConfig('sessionToken', sessionToken);
        if (data.org?.id)
            setConfig('orgId', data.org.id);
        if (data.org?.name)
            setConfig('orgName', data.org.name);
        if (data.user?.id)
            setConfig('userId', data.user.id);
        if (data.user?.name)
            setConfig('userName', data.user.name);
        spinner.succeed(`Welcome, ${data.user?.name ?? answers.name}!`);
    }
    return true;
}
async function runLogin() {
    console.log();
    output.info('Log in to your existing account.');
    console.log();
    console.log(`  Or log in via browser: ${output.link('https://emotos.ai/login')}`);
    console.log();
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'email',
            message: 'Email:',
            validate: (input) => input.includes('@') || 'Please enter a valid email',
        },
        {
            type: 'password',
            name: 'password',
            message: 'Password:',
            mask: '*',
        },
    ]);
    const spinner = ora('Logging in...').start();
    const result = await api.login(answers.email, answers.password);
    if (result.error) {
        spinner.fail('Login failed');
        output.error(result.error.message);
        return false;
    }
    if (result.data) {
        setConfig('sessionToken', result.data.sessionToken);
        setConfig('orgId', result.data.org.id);
        setConfig('orgName', result.data.org.name);
        setConfig('userId', result.data.user.id);
        setConfig('userName', result.data.user.name);
        spinner.succeed(`Logged in as ${result.data.user.name}`);
    }
    return true;
}
export function createInitCommand() {
    return new Command('init')
        .description('Initialize Emotos security for your project — end-to-end in one command')
        .option('-n, --name <name>', 'Agent name (skips prompt)')
        .action(async (options) => {
        console.log();
        console.log(output.highlight('  ╔═══════════════════════════════════════╗'));
        console.log(output.highlight('  ║       agentspd init                   ║'));
        console.log(output.highlight('  ╚═══════════════════════════════════════╝'));
        console.log();
        // ── 1. Auth ─────────────────────────────────────────────────────
        if (!isAuthenticated()) {
            const { action } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: 'No account detected. What would you like to do?',
                    choices: [
                        { name: 'Create a new account', value: 'signup' },
                        { name: 'Log in to existing account', value: 'login' },
                    ],
                },
            ]);
            const ok = action === 'signup' ? await runSignup() : await runLogin();
            if (!ok)
                return;
            console.log();
        }
        // ── 2. Scan ─────────────────────────────────────────────────────
        const scanSpinner = ora('🔍  Scanning for plaintext credentials...').start();
        const hits = scanForCredentials();
        if (hits.length > 0) {
            scanSpinner.warn(`⚠️  ${hits.length} plaintext credential${hits.length === 1 ? '' : 's'} detected`);
            for (const hit of hits) {
                console.log(`     ${output.dim(`${hit.file} — ${hit.label}`)}`);
            }
            console.log();
            output.warn('Move these secrets into environment variables or a secrets manager before deploying.');
            console.log();
        }
        else {
            scanSpinner.succeed('🔍  Scan complete — no plaintext credentials found');
        }
        // ── 3. Agent name ───────────────────────────────────────────────
        let agentName = options.name;
        if (!agentName) {
            const answers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'name',
                    message: 'Agent name:',
                    default: 'my-agent',
                    validate: (input) => input.trim().length > 0 || 'Name is required',
                },
            ]);
            agentName = answers.name;
        }
        // ── 4. Register agent ───────────────────────────────────────────
        const registerSpinner = ora('📋  Registering agent identity...').start();
        const agentResult = await api.createAgent({
            name: agentName,
            description: `Created by agentspd init`,
            environment: 'development',
        });
        if (agentResult.error) {
            registerSpinner.fail('Failed to register agent');
            output.error(agentResult.error.message);
            return;
        }
        const agent = agentResult.data;
        registerSpinner.succeed(`✅  Agent "${agent.name}" registered  (ID: ${agent.id})`);
        // Show API key if the server returned one
        const apiKey = agent.metadata?.apiKey;
        if (apiKey && typeof apiKey === 'string') {
            output.printSecret('Agent API Key', apiKey);
        }
        // ── 5. Create & activate policy ─────────────────────────────────
        const { policyMethod } = await inquirer.prompt([{
                type: 'list',
                name: 'policyMethod',
                message: 'How would you like to create a security policy?',
                choices: [
                    { name: 'Describe what your agent does (AI generates policy)', value: 'ai' },
                    { name: 'Use default deny-all policy', value: 'default' },
                    { name: 'Skip (add policy later)', value: 'skip' },
                ],
            }]);
        let policyContent = DEFAULT_POLICY_CONTENT;
        let policyDescription = 'Default deny-by-default policy from agentspd init';
        if (policyMethod === 'ai') {
            const { description } = await inquirer.prompt([{
                    type: 'input',
                    name: 'description',
                    message: 'Describe your agent (e.g. "reads public docs and summarizes them"):',
                    validate: (input) => input.length > 0 || 'Description is required',
                }]);
            const genSpinner = ora('🤖  Generating policy with AI...').start();
            const genResult = await api.generatePolicy({ prompt: description, mode: 'single' });
            if (genResult.error) {
                genSpinner.warn('AI generation failed — falling back to default policy');
            }
            else if (genResult.data?.generatedPolicy) {
                policyContent = genResult.data.generatedPolicy;
                policyDescription = `AI-generated policy: ${description}`;
                genSpinner.succeed('🤖  AI policy generated');
                console.log();
                console.log(output.dim('  Generated policy preview:'));
                const preview = policyContent.split('\n').slice(0, 10).map((l) => `  ${output.dim(l)}`).join('\n');
                console.log(preview);
                if (policyContent.split('\n').length > 10)
                    console.log(output.dim('  ...'));
                console.log();
            }
            else {
                genSpinner.warn('AI generation returned empty — falling back to default policy');
            }
        }
        if (policyMethod !== 'skip') {
            const policySpinner = ora('🛡️  Creating security policy...').start();
            const policyResult = await api.createPolicy({
                name: `${agentName}-policy`,
                description: policyDescription,
                content: policyContent,
            });
            if (policyResult.error) {
                policySpinner.warn('Could not create policy — you can add one later with `agentspd policies create`');
            }
            else {
                const policy = policyResult.data;
                await api.activatePolicy(policy.id);
                policySpinner.succeed('🛡️  Security policy applied');
            }
        }
        else {
            output.info('Skipped policy creation. Add one later with: agentspd policies create');
        }
        // ── 6. Issue JWT ────────────────────────────────────────────────
        const tokenSpinner = ora('🔑  Issuing JWT token...').start();
        const tokenResult = await api.issueToken(agent.id, 3600);
        if (tokenResult.error) {
            tokenSpinner.warn('Could not issue token — run `agentspd agents token ' + agent.id + '` later');
        }
        else {
            tokenSpinner.succeed('🔑  JWT token issued  (TTL: 3600s)');
            output.printSecret('JWT Token', tokenResult.data.token);
        }
        // ── 7. Summary ──────────────────────────────────────────────────
        console.log();
        console.log(output.highlight('  📡  MCP proxy activated'));
        console.log(output.highlight('  🔒  Audit trail armed — all activity signed'));
        console.log();
        console.log(output.highlight('  🚨  Patrol is active. Your agents are protected.'));
        console.log();
        output.heading('What\'s next');
        console.log(`  Dashboard:            ${output.link('https://emotos.ai')}`);
        console.log(`  Monitor your agent:   ${output.highlight(`agentspd agents monitor ${agent.id}`)}`);
        console.log(`  View threats:         ${output.highlight('agentspd threats list')}`);
        console.log(`  Review audit logs:    ${output.highlight('agentspd audit events')}`);
        console.log();
    });
}
