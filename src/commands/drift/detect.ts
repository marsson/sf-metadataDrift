import * as path from 'path';
import * as os from 'os';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import chalk from 'chalk';
import { OrchestrationEngine, printBanner } from '../../core/OrchestrationEngine';
import { resolveConfig } from '../../utils/ConfigResolver';
import type { DriftReport } from '../../types/DriftReport';

export default class DriftDetect extends SfCommand<DriftReport> {
  public static readonly summary = 'Detect metadata drift between a Salesforce org and a Git repository.';

  public static readonly description =
    'Compares all metadata components in the SFDX source repository against the live Salesforce org ' +
    'and reports deviations (changed or deleted components). ' +
    'Outputs results as a table, JSON, or an interactive HTML side-by-side diff report.';

  public static readonly examples = [
    '$ sf drift detect -o myOrg',
    '$ sf drift detect -o myOrg --format html --output drift-report.html',
    '$ sf drift detect -o myOrg --format json --output drift.json',
    '$ sf drift detect -o myOrg --include-types ApexClass,ApexTrigger',
    '$ sf drift detect -o myOrg --dry-run',
  ];

  public static readonly flags = {
    'target-org': Flags.requiredOrg({
      char: 'o',
      summary: 'Username or alias of the target org.',
      required: true,
    }),
    'project-dir': Flags.directory({
      summary: 'Path to SFDX project root (default: current directory).',
      default: '.',
    }),
    'source-dir': Flags.directory({
      summary: 'Explicit source directory to scan (repeatable).',
      multiple: true,
    }),
    format: Flags.string({
      options: ['table', 'json', 'html'] as const,
      summary: 'Output format: table (default), json, or html.',
      default: 'table',
    }),
    output: Flags.file({
      summary: 'Write output to file instead of stdout.',
    }),
    'batch-size': Flags.integer({
      summary: 'Components per MDAPI retrieval batch.',
      default: 500,
      min: 50,
      max: 2000,
    }),
    'retrieve-timeout': Flags.integer({
      summary: 'MDAPI retrieve timeout per batch in milliseconds.',
      default: 60_000,
    }),
    'parallel-batches': Flags.integer({
      summary: 'Number of retrieval batches to run concurrently.',
      default: 1,
      min: 1,
      max: 5,
    }),
    workers: Flags.integer({
      summary: 'Parallel comparison workers.',
      default: Math.max(1, (os.cpus().length || 2) - 1),
    }),
    'api-version': Flags.orgApiVersion(),
    'include-types': Flags.string({
      summary: 'Only compare these metadata types (comma-separated).',
    }),
    'exclude-types': Flags.string({
      summary: 'Exclude these metadata types (comma-separated, adds to defaults).',
    }),
    'no-defaults-exclusion': Flags.boolean({
      summary: 'Disable the default exclusion list (profiles, permission sets, etc.).',
      default: false,
    }),
    'report-org-only': Flags.boolean({
      summary: 'Include components found in org but not in the repo.',
      default: false,
    }),
    'temp-dir': Flags.directory({
      summary: 'Directory to store downloaded org metadata.',
    }),
    'keep-temp': Flags.boolean({
      summary: 'Keep downloaded org metadata after the run.',
      default: false,
    }),
    'dry-run': Flags.boolean({
      summary: 'Scan repository and list components without calling the org.',
      default: false,
    }),
    verbose: Flags.boolean({
      summary: 'Enable verbose logging.',
      default: false,
    }),
    'no-progress': Flags.boolean({
      summary: 'Suppress progress bars (recommended for CI pipelines).',
      default: false,
    }),
  };

  public async run(): Promise<DriftReport> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = await this.parse(DriftDetect as any) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flags = parsed.flags as Record<string, unknown>;
    const projectDir = path.resolve((flags['project-dir'] as string | undefined) ?? '.');

    const config = resolveConfig(flags as Record<string, unknown>, projectDir);

    // Get org connection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const org = (flags as any)['target-org'];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const connection = org.getConnection(flags['api-version'] as string | undefined);
    const orgId: string = org.getOrgId?.() ?? '';
    const orgAlias: string = org.getUsername?.() ?? org.getOrgId?.() ?? 'unknown';

    let apiVersion: string;
    try {
      apiVersion = flags['api-version'] as string | undefined
        ?? await connection.retrieveMaxApiVersion()
        ?? '59.0';
    } catch {
      apiVersion = '59.0';
    }

    config.apiVersion = config.apiVersion ?? apiVersion;

    printBanner(orgAlias, orgId);

    const engine = new OrchestrationEngine(connection, orgId, orgAlias, apiVersion);

    let report: DriftReport;

    if (flags['dry-run']) {
      await engine.dryRun(config);
      report = this.emptyReport(config, orgId, orgAlias, apiVersion);
    } else {
      report = await engine.run(config);
    }

    if (report.summary.totalDrifted > 0) {
      process.exitCode = 1;
    }

    return report;
  }

  private emptyReport(
    config: ReturnType<typeof resolveConfig>,
    orgId: string,
    orgAlias: string,
    apiVersion: string
  ): DriftReport {
    return {
      meta: {
        generatedAt: new Date().toISOString(),
        apiVersion,
        orgId,
        orgAlias,
        projectDir: config.projectDir,
        scanDurationMs: 0,
        toolVersion: this.config.pjson?.version ?? '0.1.0',
      },
      summary: { totalScanned: 0, totalDrifted: 0, changed: 0, deleted: 0, orgOnly: 0, unchanged: 0 },
      components: [],
    };
  }

  public async catch(err: Error): Promise<never> {
    process.stderr.write(`\n${chalk.red.bold('Error:')} ${err.message}\n`);
    if (process.env.SF_DRIFT_VERBOSE === 'true' || process.env.DEBUG) {
      process.stderr.write(chalk.dim(err.stack ?? '') + '\n');
    }
    process.exitCode = 2;
    throw err;
  }
}
