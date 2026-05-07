import * as path from 'path';
import * as fs from 'fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import chalk from 'chalk';

const DEFAULT_RC = {
  $schema: 'https://raw.githubusercontent.com/marsson/sf-metadata-drift/main/schema/driftrc.schema.json',
  defaultFormat: 'table',
  batchSize: 500,
  retrieveTimeout: 60000,
  parallelBatches: 1,
  workers: 4,
  reportOrgOnly: false,
  exclusions: {
    useDefaults: true,
    additionalTypes: [],
    includeOverride: [],
  },
  ignorePatterns: [],
  comparison: {
    xmlNormalization: true,
    ignoreWhitespace: true,
    ignoreComments: true,
    contextLines: 5,
  },
  htmlReport: {
    title: 'Salesforce Drift Report',
    theme: 'light',
    includeUnchanged: false,
    syntaxHighlight: true,
  },
  tempDir: '.drift-cache',
  keepTemp: false,
  verbose: false,
};

export default class DriftInit extends SfCommand<void> {
  public static readonly summary = 'Initialise a .driftrc.json configuration file in the project root.';

  public static readonly examples = [
    '$ sf drift init',
    '$ sf drift init --project-dir /path/to/sfdx-project',
  ];

  public static readonly flags = {
    'project-dir': Flags.directory({
      summary: 'Path to SFDX project root.',
      default: '.',
    }),
    force: Flags.boolean({
      summary: 'Overwrite existing .driftrc.json without prompting.',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(DriftInit);
    const projectDir = path.resolve(flags['project-dir'] as string);
    const rcPath = path.join(projectDir, '.driftrc.json');

    if (fs.existsSync(rcPath) && !flags.force) {
      process.stdout.write(
        chalk.yellow(`  .driftrc.json already exists at ${rcPath}.\n`) +
        `  Use ${chalk.bold('--force')} to overwrite it.\n`
      );
      return;
    }

    const content = JSON.stringify(DEFAULT_RC, null, 2);
    await fs.promises.writeFile(rcPath, content + '\n', 'utf8');

    process.stdout.write(
      chalk.green('  ✔ Created .driftrc.json\n') +
      chalk.dim(`  Path: ${rcPath}\n\n`) +
      `  Add ${chalk.bold('$schema')} to get IDE autocompletion.\n` +
      `  Run ${chalk.bold('sf drift detect --help')} to see all available flags.\n`
    );
  }
}
