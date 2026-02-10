import { Command } from 'commander';
import inquirer from 'inquirer';
import * as configModule from '../config.js';
import * as output from '../output.js';

export function createConfigCommand(): Command {
  const config = new Command('config')
    .description('Manage CLI configuration');

  config
    .command('list')
    .alias('ls')
    .description('Show all configuration values')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const cfg = configModule.getConfig();
      
      if (options.json) {
        // Hide sensitive values
        const safe = {
          ...cfg,
          apiKey: cfg.apiKey ? '***' : undefined,
          sessionToken: cfg.sessionToken ? '***' : undefined,
        };
        output.printJson(safe);
      } else {
        output.heading('Configuration');
        output.printKeyValue([
          ['API URL', cfg.apiUrl],
          ['Organization ID', cfg.orgId],
          ['Organization Name', cfg.orgName],
          ['User ID', cfg.userId],
          ['User Name', cfg.userName],
          ['Default Environment', cfg.defaultEnvironment],
          ['Output Format', cfg.outputFormat],
          ['Auth Method', cfg.apiKey ? 'API Key' : cfg.sessionToken ? 'Session' : 'None'],
        ]);
      }
    });

  config
    .command('get <key>')
    .description('Get a configuration value')
    .action((key) => {
      const cfg = configModule.getConfig();
      const value = cfg[key as keyof typeof cfg];
      
      if (value === undefined) {
        output.error(`Unknown configuration key: ${key}`);
        return;
      }

      // Hide sensitive values
      if (key === 'apiKey' || key === 'sessionToken') {
        console.log(value ? '***' : '(not set)');
      } else {
        console.log(value);
      }
    });

  config
    .command('set <key> <value>')
    .description('Set a configuration value')
    .action((key, value) => {
      const validKeys = ['apiUrl', 'defaultEnvironment', 'outputFormat'];
      
      if (!validKeys.includes(key)) {
        output.error(`Cannot set ${key}. Valid keys: ${validKeys.join(', ')}`);
        return;
      }

      if (key === 'defaultEnvironment') {
        const validEnvs = ['development', 'staging', 'production'];
        if (!validEnvs.includes(value)) {
          output.error(`Invalid environment. Valid values: ${validEnvs.join(', ')}`);
          return;
        }
      }

      if (key === 'outputFormat') {
        const validFormats = ['table', 'json', 'yaml'];
        if (!validFormats.includes(value)) {
          output.error(`Invalid format. Valid values: ${validFormats.join(', ')}`);
          return;
        }
      }

      configModule.setConfig(key as keyof configModule.EmotosConfig, value);
      output.success(`Set ${key} = ${value}`);
    });

  config
    .command('reset')
    .description('Reset all configuration to defaults')
    .option('-f, --force', 'Skip confirmation')
    .action(async (options) => {
      if (!options.force) {
        const answers = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Reset all configuration to defaults? This will log you out.',
            default: false,
          },
        ]);
        if (!answers.confirm) {
          output.info('Operation cancelled');
          return;
        }
      }

      configModule.clearConfig();
      output.success('Configuration reset to defaults');
    });

  config
    .command('path')
    .description('Show configuration file path')
    .action(() => {
      console.log(configModule.config.path);
    });

  return config;
}
