import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { api } from '../api.js';
import { setConfig, clearConfig, getConfig, isAuthenticated } from '../config.js';
import * as output from '../output.js';

export function createAuthCommand(): Command {
  const auth = new Command('auth')
    .description('Authentication commands');

  auth
    .command('login')
    .description('Log in to Emotos')
    .option('-e, --email <email>', 'Email address')
    .option('-p, --password <password>', 'Password')
    .option('-k, --api-key <key>', 'Use API key instead of email/password')
    .action(async (options) => {
      console.log();
      console.log(`  Or log in via browser: ${output.link('https://emotos.ai/login')}`);
      console.log();
      if (options.apiKey) {
        setConfig('apiKey', options.apiKey);
        
        const spinner = ora('Verifying API key...').start();
        const result = await api.me();
        
        if (result.error) {
          spinner.fail('Invalid API key');
          clearConfig();
          return;
        }
        
        spinner.succeed('Logged in successfully');
        if (result.data) {
          setConfig('orgId', result.data.org.id);
          setConfig('orgName', result.data.org.name);
          output.info(`Organization: ${result.data.org.name}`);
        }
        return;
      }

      let email = options.email;
      let password = options.password;

      if (!email) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'email',
            message: 'Email:',
            validate: (input: string) => input.includes('@') || 'Please enter a valid email',
          },
        ]);
        email = answers.email;
      }

      if (!password) {
        const answers = await inquirer.prompt([
          {
            type: 'password',
            name: 'password',
            message: 'Password:',
            mask: '*',
          },
        ]);
        password = answers.password;
      }

      const spinner = ora('Logging in...').start();
      const result = await api.login(email, password);

      if (result.error) {
        spinner.fail('Login failed');
        output.error(result.error.message);
        return;
      }

      if (result.data) {
        // API returns "token" or "sessionToken" depending on version
        const sessionToken = result.data.sessionToken || (result.data as any).token;
        setConfig('sessionToken', sessionToken);
        setConfig('orgId', result.data.org?.id);
        setConfig('orgName', result.data.org?.name);
        setConfig('userId', result.data.user?.id);
        setConfig('userName', result.data.user?.name);
        
        spinner.succeed(`Logged in as ${result.data.user?.name ?? result.data.org?.name ?? email}`);
        output.info(`Organization: ${result.data.org?.name ?? 'N/A'}`);
        output.info(`Role: ${result.data.user?.role ?? 'N/A'}`);
      }
    });

  auth
    .command('signup')
    .description('Create a new Emotos account')
    .option('-e, --email <email>', 'Email address')
    .option('-p, --password <password>', 'Password')
    .option('-n, --name <name>', 'Your name')
    .option('-o, --org-name <name>', 'Organization name')
    .action(async (options) => {
      console.log();
      console.log(`  Or sign up via browser: ${output.link('https://emotos.ai/signup')}`);
      console.log();
      let email = options.email;
      let password = options.password;
      let name = options.name;
      let orgName = options.orgName;

      const prompts: Array<{ type: string; name: string; message: string; validate?: (input: string) => boolean | string; mask?: string }> = [];

      if (!email) {
        prompts.push({
          type: 'input',
          name: 'email',
          message: 'Email:',
          validate: (input: string) => input.includes('@') || 'Please enter a valid email',
        });
      }

      if (!password) {
        prompts.push({
          type: 'password',
          name: 'password',
          message: 'Password (min 8 characters):',
          mask: '*',
          validate: (input: string) => input.length >= 8 || 'Password must be at least 8 characters',
        });
      }

      if (!name) {
        prompts.push({
          type: 'input',
          name: 'name',
          message: 'Your name:',
          validate: (input: string) => input.length > 0 || 'Name is required',
        });
      }

      if (!orgName) {
        prompts.push({
          type: 'input',
          name: 'orgName',
          message: 'Organization name (optional):',
        });
      }

      if (prompts.length > 0) {
        const answers = await inquirer.prompt(prompts);
        email = email || answers.email;
        password = password || answers.password;
        name = name || answers.name;
        orgName = orgName || answers.orgName;
      }

      const role = 'free';

      const spinner = ora('Creating account...').start();
      const result = await api.signup({ email, password, name, role, orgName: orgName || undefined });

      if (result.error) {
        spinner.fail('Signup failed');
        output.error(result.error.message);
        return;
      }

      if (result.data) {
        const data = result.data as any;

        // API may return a verification-required response (no session yet)
        if (data.requiresVerification) {
          spinner.succeed('Account created — email verification required');
          output.info(`Email: ${data.email}`);
          if (data.orgApiKey) {
            setConfig('apiKey', data.orgApiKey);
            output.info(`Org API Key saved (use for auth until verified)`);
          }
          console.log();
          output.info('Next steps:');
          console.log('  1. Verify your email (check inbox or API logs in dev mode)');
          console.log(`  2. Then log in at: ${output.link('https://emotos.ai/login')}`);
          console.log('  3. Or run: agentspd auth login');
          return;
        }

        // Full session response (legacy / auto-verified flow)
        const sessionToken = data.sessionToken || data.token;
        setConfig('sessionToken', sessionToken);
        setConfig('orgId', data.org?.id);
        setConfig('orgName', data.org?.name);
        setConfig('userId', data.user?.id);
        setConfig('userName', data.user?.name);
        
        spinner.succeed('Account created successfully!');
        output.info(`Welcome, ${data.user?.name ?? email}!`);
        output.info(`Organization: ${data.org?.name ?? orgName ?? 'N/A'}`);
        console.log();
        output.info('Next steps:');
        console.log(`  Dashboard:            ${output.link('https://emotos.ai')}`);
        console.log('  1. Run the quickstart: agentspd init');
        console.log('  2. Or manually: agentspd policies create && agentspd agents create');
        console.log('  3. Point your agent at: wss://emotos.ai/v1/mcp');
      }
    });

  auth
    .command('logout')
    .description('Log out of Emotos')
    .action(async () => {
      if (!isAuthenticated()) {
        output.info('Not logged in');
        return;
      }

      const spinner = ora('Logging out...').start();
      await api.logout();
      clearConfig();
      spinner.succeed('Logged out successfully');
    });

  auth
    .command('whoami')
    .alias('me')
    .description('Show current user information')
    .action(async () => {
      if (!isAuthenticated()) {
        output.error('Not logged in. Run `emotos auth login` first.');
        return;
      }

      const spinner = ora('Fetching user info...').start();
      const result = await api.me();

      if (result.error) {
        spinner.fail('Failed to fetch user info');
        output.error(result.error.message);
        return;
      }

      spinner.stop();
      
      if (result.data) {
        output.heading('Current User');
        const pairs: [string, string][] = [];
        if (result.data.user) {
          pairs.push(
            ['Name', result.data.user.name],
            ['Email', result.data.user.email],
            ['Role', result.data.user.role],
          );
        } else {
          pairs.push(['Auth', 'Org API Key']);
        }
        if (result.data.org) {
          pairs.push(
            ['Organization', result.data.org.name],
            ['Org ID', result.data.org.id],
            ['Tier', result.data.org.tier],
          );
        }
        output.printKeyValue(pairs);
      }
    });

  auth
    .command('status')
    .description('Check authentication status')
    .action(() => {
      const config = getConfig();
      
      if (!isAuthenticated()) {
        output.error('Not authenticated');
        output.info('Run `emotos auth login` to authenticate');
        return;
      }

      output.success('Authenticated');
      output.printKeyValue([
        ['API URL', config.apiUrl],
        ['Organization', config.orgName],
        ['User', config.userName],
        ['Auth Method', config.apiKey ? 'API Key' : 'Session'],
      ]);
    });

  return auth;
}
