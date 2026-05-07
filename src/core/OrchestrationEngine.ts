import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import { RepositoryScanner } from './discovery/RepositoryScanner';
import { OrgRetriever } from './retrieval/OrgRetriever';
import { ComparisonEngine } from './comparison/ComparisonEngine';
import { createReporter } from './reporting/Reporter';
import { parseSfdxProject, getSourceDirs } from './discovery/SfdxProjectParser';
import { makeTempDir, removeDirRecursive, formatDuration } from '../utils/FileUtils';
import { DriftLogger } from '../utils/Logger';
import type { ComponentRegistry } from './discovery/ComponentRegistry';
import type { DriftReport } from '../types/DriftReport';
import type { ResolvedConfig } from '../types/Config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyOrg = any;

export class OrchestrationEngine {
  private logger: DriftLogger;

  constructor(
    private readonly connection: AnyOrg,
    private readonly orgId: string,
    private readonly orgAlias: string,
    private readonly apiVersion: string
  ) {
    this.logger = DriftLogger.create(false);
  }

  async dryRun(config: ResolvedConfig): Promise<ComponentRegistry> {
    const { registry } = await this.stage1Discover(config);
    this.printDryRunTable(registry);
    return registry;
  }

  async run(config: ResolvedConfig): Promise<DriftReport> {
    const startTime = Date.now();
    this.logger = DriftLogger.create(config.verbose);

    const verbose = config.verbose;

    // ── Stage 1: Discovery ─────────────────────────────
    this.logger.stage('Stage 1: Repository Scan');
    const t1 = Date.now();
    const { registry, sourceDirs: discoveredDirs } = await this.stage1Discover(config);
    const d1 = Date.now() - t1;
    this.logger.success(
      `Found ${chalk.bold(String(registry.size))} components across ` +
      `${chalk.bold(String(discoveredDirs.length))} ` +
      `source ${discoveredDirs.length === 1 ? 'directory' : 'directories'} ` +
      chalk.dim(`(${formatDuration(d1)})`)
    );

    if (registry.size === 0) {
      this.logger.warn('No components found. Check --project-dir and exclusion settings.');
      return this.emptyReport(config, startTime);
    }

    // ── Stage 2: Org Retrieval ─────────────────────────
    this.logger.stage('Stage 2: Org Retrieval');
    const t2 = Date.now();

    const tempDir = config.tempDir
      ? path.resolve(config.tempDir)
      : makeTempDir('sf-metadata-drift-');

    if (verbose) this.logger.info(`Temp directory: ${tempDir}`);

    const retriever = new OrgRetriever(this.connection, {
      batchSize: config.batchSize,
      retrieveTimeout: config.retrieveTimeout,
      parallelBatches: config.parallelBatches,
      apiVersion: config.apiVersion,
      tempDir,
      verbose: config.verbose,
      noProgress: config.noProgress,
    });

    let snapshot;
    try {
      snapshot = await retriever.retrieve(registry);
    } catch (err) {
      if (!config.keepTemp) {
        await removeDirRecursive(tempDir).catch(() => undefined);
      }
      throw err;
    }

    const d2 = Date.now() - t2;
    const failStr = snapshot.failedComponents.length > 0
      ? chalk.yellow(`, ${snapshot.failedComponents.length} failures`)
      : '';
    this.logger.success(
      `Retrieved ${chalk.bold(String(snapshot.fileIndex.size))} components` +
      failStr + ' ' + chalk.dim(`(${formatDuration(d2)})`)
    );

    if (snapshot.failedComponents.length > 0 && config.verbose) {
      for (const f of snapshot.failedComponents.slice(0, 5)) {
        this.logger.warn(`  ${f.manifestKey}: ${f.error}`);
      }
    }

    // ── Stage 3: Comparison ───────────────────────────
    this.logger.stage('Stage 3: Comparison');
    const t3 = Date.now();

    const engine = new ComparisonEngine(config.comparison, config.noProgress);
    const driftResults = await engine.compare(registry, snapshot);

    const d3 = Date.now() - t3;
    this.logger.success(`Comparison complete ${chalk.dim(`(${formatDuration(d3)})`)}`);

    // Cleanup temp dir unless requested
    if (!config.keepTemp) {
      await removeDirRecursive(tempDir).catch(() => undefined);
    }

    // ── Stage 4: Report ───────────────────────────────
    this.logger.stage('Stage 4: Report Generation');

    const totalScanned = registry.size;
    const changed = driftResults.filter(r => r.status === 'CHANGED').length;
    const deleted = driftResults.filter(r => r.status === 'DELETED').length;
    const orgOnly = driftResults.filter(r => r.status === 'ORG_ONLY').length;
    const totalDrifted = changed + deleted + orgOnly;
    const unchanged = totalScanned - totalDrifted;

    const report: DriftReport = {
      meta: {
        generatedAt: new Date().toISOString(),
        apiVersion: this.apiVersion,
        orgId: this.orgId,
        orgAlias: this.orgAlias,
        projectDir: config.projectDir,
        scanDurationMs: Date.now() - startTime,
        toolVersion: this.getToolVersion(),
      },
      summary: {
        totalScanned,
        totalDrifted,
        changed,
        deleted,
        orgOnly,
        unchanged,
      },
      components: driftResults,
    };

    const reporter = createReporter(config.format);
    await reporter.generate(report, {
      outputFile: config.outputFile,
      verbose: config.verbose,
      htmlOptions: config.htmlReport,
    });

    const t4 = Date.now() - t3;
    this.logger.success(`Report generated ${chalk.dim(`(${formatDuration(t4)})`)}`);

    // ── Final Summary ─────────────────────────────────
    this.printFinalSummary(report);

    return report;
  }

  private async stage1Discover(config: ResolvedConfig): Promise<{ registry: ComponentRegistry; sourceDirs: string[] }> {
    // If explicit source dirs were passed, skip sfdx-project.json entirely
    let sourceDirs: string[];
    if (config.sourceDirs && config.sourceDirs.length > 0) {
      sourceDirs = config.sourceDirs.map(d => path.resolve(d));
    } else {
      const project = await parseSfdxProject(config.projectDir);
      sourceDirs = getSourceDirs(project);
    }

    if (!config.noProgress) {
      process.stdout.write(`  ${chalk.gray('⠼')} Scanning ${sourceDirs.map(d => path.relative(config.projectDir, d) || d).join(', ')}...\r`);
    }

    const scanner = new RepositoryScanner();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const includeTypes = (config as any).includeTypes as string[] | null ?? null;

    const registry = await scanner.scan(sourceDirs, {
      projectDir: config.projectDir,
      sourceDirs,
      ignorePatterns: config.ignorePatterns,
      exclusions: config.exclusions,
      includeTypes,
      verbose: config.verbose,
    });

    if (!config.noProgress) {
      process.stdout.write(' '.repeat(80) + '\r');
    }

    return { registry, sourceDirs };
  }

  private printDryRunTable(registry: ComponentRegistry): void {
    const byType = registry.byType();
    const sorted = Array.from(byType.entries()).sort(([a], [b]) => a.localeCompare(b));

    this.logger.blank();
    process.stdout.write(
      chalk.bold('  ' + 'Metadata Type'.padEnd(30) + 'Count') + '\n' +
      '  ' + '─'.repeat(40) + '\n'
    );

    for (const [type, entries] of sorted) {
      process.stdout.write(
        `  ${type.padEnd(30)}${chalk.bold(String(entries.length))}\n`
      );
    }

    process.stdout.write(
      '  ' + '─'.repeat(40) + '\n' +
      `  ${'TOTAL'.padEnd(30)}${chalk.bold(String(registry.size))}\n`
    );
    this.logger.blank();
    this.logger.info(chalk.dim('Dry run complete — no org calls were made.'));
  }

  private printFinalSummary(report: DriftReport): void {
    const { changed, deleted, orgOnly, totalScanned, totalDrifted } = report.summary;
    const duration = formatDuration(report.meta.scanDurationMs);
    const bar = '─'.repeat(52);

    process.stdout.write('\n');
    process.stdout.write(chalk.dim(bar) + '\n');
    process.stdout.write(
      `  ${chalk.bold('DRIFT SUMMARY')}   ` +
      `${chalk.bold(String(totalScanned))} scanned · ` +
      (totalDrifted > 0 ? chalk.red.bold(String(totalDrifted) + ' drifted') : chalk.green.bold('clean')) +
      ` · ${chalk.green(String(report.summary.unchanged))} clean\n`
    );
    process.stdout.write(chalk.dim(bar) + '\n');

    if (totalDrifted > 0) {
      const parts = [];
      if (changed > 0)  parts.push(`  ${chalk.yellow.bold('CHANGED')}   ${chalk.yellow.bold(String(changed))}`);
      if (deleted > 0)  parts.push(`  ${chalk.red.bold('DELETED')}   ${chalk.red.bold(String(deleted))}`);
      if (orgOnly > 0)  parts.push(`  ${chalk.cyan.bold('ORG_ONLY')}  ${chalk.cyan.bold(String(orgOnly))}`);
      process.stdout.write(parts.join('     ') + '\n');
      process.stdout.write(chalk.dim(bar) + '\n');
    }

    process.stdout.write(chalk.dim(`  Duration: ${duration}\n`));
    process.stdout.write('\n');
  }

  private emptyReport(config: ResolvedConfig, startTime: number): DriftReport {
    return {
      meta: {
        generatedAt: new Date().toISOString(),
        apiVersion: this.apiVersion,
        orgId: this.orgId,
        orgAlias: this.orgAlias,
        projectDir: config.projectDir,
        scanDurationMs: Date.now() - startTime,
        toolVersion: this.getToolVersion(),
      },
      summary: { totalScanned: 0, totalDrifted: 0, changed: 0, deleted: 0, orgOnly: 0, unchanged: 0 },
      components: [],
    };
  }

  private getToolVersion(): string {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return (require('../../package.json') as { version: string }).version;
    } catch {
      return '0.1.0';
    }
  }
}

export function printBanner(orgAlias: string, orgId: string): void {
  const banner = chalk.cyan.bold(`
  ____        _           ____       _  __ _
 |  _ \\  __ _| |_ __ _  |  _ \\ _ __(_)/ _| |_
 | | | |/ _\` | __/ _\` | | | | | '__| | |_| __|
 | |_| | (_| | || (_| | | |_| | |  | |  _| |_
 |____/ \\__,_|\\__\\__,_| |____/|_|  |_|_|  \\__|`);

  process.stdout.write(banner + '\n');
  process.stdout.write(chalk.dim(' sf-metadata-drift by Marsson\n'));
  process.stdout.write(` ${chalk.dim('Target org:')} ${chalk.bold(orgAlias)} ${chalk.dim(orgId ? `(${orgId})` : '')}\n`);
}
