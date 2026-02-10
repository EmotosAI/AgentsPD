import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import * as fs from 'node:fs';
import { api } from '../api.js';
import * as output from '../output.js';

const DEFAULT_POLICY_TEMPLATE = `# Emotos Security Policy
# Version 1.0

version: "1.0"
name: "my-policy"
description: "My security policy"

settings:
  default_action: deny
  require_identity: true

# Tool permissions
tools:
  # Allow read operations
  - pattern: "read_*"
    action: allow
    
  # Block dangerous operations
  - pattern: "exec_*"
    action: deny
    reason: "Shell execution not permitted"
    
  # Allow with rate limiting
  - pattern: "web_*"
    action: allow
    rate_limit:
      requests_per_minute: 10

# Prompt injection protection
prompt_injection:
  enabled: true
  action: block
  
# Data exfiltration prevention
exfiltration:
  enabled: true
  block_patterns:
    - name: "aws_keys"
      pattern: "AKIA[0-9A-Z]{16}"
    - name: "private_keys"
      pattern: "-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----"
`;

export function createPoliciesCommand(): Command {
  const policies = new Command('policies')
    .alias('policy')
    .description('Manage security policies');

  policies
    .command('create')
    .description('Create a new security policy')
    .option('-n, --name <name>', 'Policy name')
    .option('-d, --description <desc>', 'Policy description')
    .option('-f, --file <path>', 'Read policy content from file')
    .option('-t, --template', 'Start with a template')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      let name = options.name;
      let description = options.description;
      let content: string;

      // Get policy content
      if (options.file) {
        if (!fs.existsSync(options.file)) {
          output.error(`File not found: ${options.file}`);
          return;
        }
        content = fs.readFileSync(options.file, 'utf-8');
      } else if (options.template) {
        content = DEFAULT_POLICY_TEMPLATE;
      } else {
        // Offer AI generation as the primary option
        const { method } = await inquirer.prompt([{
          type: 'list',
          name: 'method',
          message: 'Create policy from:',
          choices: [
            { name: 'Natural language description (AI generates the policy)', value: 'ai' },
            { name: 'YAML editor (manual)', value: 'editor' },
            { name: 'Default template', value: 'template' },
          ],
        }]);

        if (method === 'ai') {
          const { prompt } = await inquirer.prompt([{
            type: 'input',
            name: 'prompt',
            message: 'Describe what your agent does and what it should be allowed to do:',
            validate: (input: string) => input.length > 0 || 'Description is required',
          }]);

          const genSpinner = ora('Generating policy with AI...').start();
          const genResult = await api.generatePolicy({ prompt, mode: 'single' });

          if (genResult.error || !genResult.data?.generatedPolicy) {
            genSpinner.fail('AI generation failed');
            output.error(genResult.error?.message ?? 'Empty response');
            return;
          }

          content = genResult.data.generatedPolicy;
          genSpinner.succeed('Policy generated!');
          console.log();
          console.log(content);
          console.log();

          const { confirmed } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirmed',
            message: 'Use this generated policy?',
            default: true,
          }]);

          if (!confirmed) {
            // Let them edit it
            const editAnswers = await inquirer.prompt([{
              type: 'editor',
              name: 'content',
              message: 'Edit the generated policy:',
              default: content,
            }]);
            content = editAnswers.content;
          }
        } else if (method === 'template') {
          content = DEFAULT_POLICY_TEMPLATE;
        } else {
          const answers = await inquirer.prompt([{
            type: 'editor',
            name: 'content',
            message: 'Policy content:',
            default: DEFAULT_POLICY_TEMPLATE,
          }]);
          content = answers.content;
        }
      }

      // Get name and description if not provided
      if (!name) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Policy name:',
            validate: (input: string) => input.length > 0 || 'Name is required',
          },
        ]);
        name = answers.name;
      }

      if (!description) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'description',
            message: 'Description (optional):',
          },
        ]);
        description = answers.description || undefined;
      }

      // Validate first
      const validateSpinner = ora('Validating policy...').start();
      const validateResult = await api.validatePolicy(content);

      if (validateResult.error || (validateResult.data && !validateResult.data.valid)) {
        validateSpinner.fail('Policy validation failed');
        if (validateResult.data?.errors) {
          for (const err of validateResult.data.errors) {
            output.error(err);
          }
        } else if (validateResult.error) {
          output.error(validateResult.error.message);
        }
        return;
      }

      if (options.json) {
        validateSpinner.stop();
      } else {
        validateSpinner.succeed('Policy validated');
      }

      // Create policy
      const spinner = ora('Creating policy...').start();
      const result = await api.createPolicy({ name, description, content });

      if (result.error) {
        spinner.fail('Failed to create policy');
        output.error(result.error.message);
        return;
      }

      if (options.json) {
        spinner.stop();
        output.printJson(result.data);
      } else {
        spinner.succeed('Policy created successfully!');
        if (result.data) {
          console.log();
          output.printKeyValue([
            ['Policy ID', result.data.id],
            ['Name', result.data.name],
            ['Version', result.data.version],
            ['Active', result.data.isActive ? 'Yes' : 'No'],
            ['Created', output.formatDate(result.data.createdAt)],
          ]);
          
          console.log();
          output.info('Next steps:');
          console.log(`  1. Activate policy: ${output.highlight(`emotos policies activate ${result.data.id}`)}`);
          console.log(`  2. Assign to agent: ${output.highlight(`emotos agents create --policy ${result.data.id}`)}`);
        }
      }
    });

  policies
    .command('list')
    .alias('ls')
    .description('List all policies')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const spinner = ora('Fetching policies...').start();
      const result = await api.listPolicies();

      if (result.error) {
        spinner.fail('Failed to fetch policies');
        output.error(result.error.message);
        return;
      }

      spinner.stop();

      if (options.json) {
        output.printJson(result.data);
      } else if (result.data) {
        if (result.data.policies.length === 0) {
          output.info('No policies found');
          output.info('Create one with: emotos policies create');
          return;
        }
        output.heading('Security Policies');
        output.printPolicyTable(result.data.policies);
      }
    });

  policies
    .command('get <policyId>')
    .alias('show')
    .description('Get policy details (accepts name or ID)')
    .option('--json', 'Output as JSON')
    .option('--content', 'Show policy content only')
    .action(async (policyIdOrName, options) => {
      let policyId: string;
      try { policyId = await api.resolvePolicy(policyIdOrName); } catch (e: any) { output.error(e.message); return; }
      const spinner = ora('Fetching policy...').start();
      const result = await api.getPolicy(policyId);

      if (result.error) {
        spinner.fail('Failed to fetch policy');
        output.error(result.error.message);
        return;
      }

      spinner.stop();

      if (options.content && result.data) {
        console.log(result.data.content);
        return;
      }

      if (options.json) {
        output.printJson(result.data);
      } else if (result.data) {
        output.heading(`Policy: ${result.data.name}`);
        output.printKeyValue([
          ['ID', result.data.id],
          ['Name', result.data.name],
          ['Description', result.data.description],
          ['Version', result.data.version],
          ['Active', result.data.isActive ? 'Yes' : 'No'],
          ['Created', output.formatDate(result.data.createdAt)],
          ['Updated', result.data.updatedAt ? output.formatDate(result.data.updatedAt) : undefined],
        ]);

        console.log();
        output.heading('Content');
        console.log(result.data.content);
      }
    });

  policies
    .command('update <policyId>')
    .description('Update a policy (accepts name or ID)')
    .option('-f, --file <path>', 'Read policy content from file')
    .option('--json', 'Output as JSON')
    .action(async (policyIdOrName, options) => {
      let policyId: string;
      try { policyId = await api.resolvePolicy(policyIdOrName); } catch (e: any) { output.error(e.message); return; }
      let content: string;

      if (options.file) {
        if (!fs.existsSync(options.file)) {
          output.error(`File not found: ${options.file}`);
          return;
        }
        content = fs.readFileSync(options.file, 'utf-8');
      } else {
        // Fetch current content
        const current = await api.getPolicy(policyId);
        if (current.error) {
          output.error(current.error.message);
          return;
        }

        const answers = await inquirer.prompt([
          {
            type: 'editor',
            name: 'content',
            message: 'Policy content:',
            default: current.data?.content,
          },
        ]);
        content = answers.content;
      }

      // Validate first
      const validateSpinner = ora('Validating policy...').start();
      const validateResult = await api.validatePolicy(content);

      if (validateResult.error || (validateResult.data && !validateResult.data.valid)) {
        validateSpinner.fail('Policy validation failed');
        if (validateResult.data?.errors) {
          for (const err of validateResult.data.errors) {
            output.error(err);
          }
        }
        return;
      }

      if (options.json) {
        validateSpinner.stop();
      } else {
        validateSpinner.succeed('Policy validated');
      }

      // Update policy
      const spinner = ora('Updating policy...').start();
      const result = await api.updatePolicy(policyId, content);

      if (result.error) {
        spinner.fail('Failed to update policy');
        output.error(result.error.message);
        return;
      }

      if (options.json) {
        spinner.stop();
        output.printJson(result.data);
      } else {
        spinner.succeed('Policy updated successfully!');
        if (result.data) {
          output.printKeyValue([
            ['Version', result.data.version],
            ['Updated', result.data.updatedAt ? output.formatDate(result.data.updatedAt) : 'Now'],
          ]);
        }
      }
    });

  policies
    .command('validate')
    .description('Validate a policy file')
    .argument('<file>', 'Policy file to validate')
    .action(async (file: string) => {
      if (!fs.existsSync(file)) {
        output.error(`File not found: ${file}`);
        return;
      }

      const content = fs.readFileSync(file, 'utf-8');
      const spinner = ora('Validating policy...').start();
      const result = await api.validatePolicy(content);

      if (result.error) {
        spinner.fail('Validation failed');
        output.error(result.error.message);
        return;
      }

      if (result.data?.valid) {
        spinner.succeed('Policy is valid!');
      } else {
        spinner.fail('Policy is invalid');
        if (result.data?.errors) {
          for (const err of result.data.errors) {
            output.error(err);
          }
        }
      }
    });

  policies
    .command('activate <policyId>')
    .description('Activate a policy (accepts name or ID)')
    .action(async (policyIdOrName) => {
      let policyId: string;
      try { policyId = await api.resolvePolicy(policyIdOrName); } catch (e: any) { output.error(e.message); return; }
      const spinner = ora('Activating policy...').start();
      const result = await api.activatePolicy(policyId);

      if (result.error) {
        spinner.fail('Failed to activate policy');
        output.error(result.error.message);
        return;
      }

      spinner.succeed('Policy activated!');
    });

  policies
    .command('deactivate <policyId>')
    .description('Deactivate a policy (accepts name or ID)')
    .action(async (policyIdOrName) => {
      let policyId: string;
      try { policyId = await api.resolvePolicy(policyIdOrName); } catch (e: any) { output.error(e.message); return; }
      const spinner = ora('Deactivating policy...').start();
      const result = await api.deactivatePolicy(policyId);

      if (result.error) {
        spinner.fail('Failed to deactivate policy');
        output.error(result.error.message);
        return;
      }

      spinner.succeed('Policy deactivated');
    });

  policies
    .command('init')
    .description('Initialize a new policy file from template')
    .option('-o, --output <path>', 'Output file path', 'emotos-policy.yaml')
    .action(async (options) => {
      if (fs.existsSync(options.output)) {
        const answers = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: `File ${options.output} already exists. Overwrite?`,
            default: false,
          },
        ]);
        if (!answers.overwrite) {
          output.info('Operation cancelled');
          return;
        }
      }

      fs.writeFileSync(options.output, DEFAULT_POLICY_TEMPLATE);
      output.success(`Policy template created: ${options.output}`);
      output.info('Edit this file to customize your security policy');
      output.info(`Then upload with: emotos policies create --file ${options.output}`);
    });

  return policies;
}
