import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import type { DriftRcFile, ResolvedConfig, ComparisonConfig, HtmlReportConfig, ExclusionConfig } from '../types/Config';

const DEFAULTS = {
  format: 'table' as const,
  batchSize: 500,
  retrieveTimeout: 60_000,
  parallelBatches: 1,
  workers: Math.max(1, (os.cpus().length || 2) - 1),
  workerMemoryMb: 512,
  reportOrgOnly: false,
  keepTemp: false,
  dryRun: false,
  verbose: false,
  noProgress: false,
};

function readRcFile(projectDir: string): DriftRcFile {
  const rcPath = path.join(projectDir, '.driftrc.json');
  if (fs.existsSync(rcPath)) {
    try {
      return JSON.parse(fs.readFileSync(rcPath, 'utf8')) as DriftRcFile;
    } catch {
      // ignore malformed rc file
    }
  }
  return {};
}

function envStr(key: string): string | undefined {
  return process.env[`SF_DRIFT_${key}`] || undefined;
}

function envInt(key: string): number | undefined {
  const v = process.env[`SF_DRIFT_${key}`];
  return v ? parseInt(v, 10) : undefined;
}

function envBool(key: string): boolean | undefined {
  const v = process.env[`SF_DRIFT_${key}`];
  if (v === undefined) return undefined;
  return v === 'true' || v === '1';
}

export function resolveConfig(
  flags: Record<string, unknown>,
  projectDir: string
): ResolvedConfig {
  const rc = readRcFile(projectDir);

  const targetOrg =
    (flags['target-org'] as string | undefined) ||
    envStr('TARGET_ORG') ||
    rc.targetOrg ||
    '';

  const format =
    (flags['format'] as 'table' | 'json' | 'html' | undefined) ||
    (envStr('FORMAT') as 'table' | 'json' | 'html' | undefined) ||
    rc.defaultFormat ||
    DEFAULTS.format;

  const outputFile =
    (flags['output'] as string | undefined) ||
    envStr('OUTPUT') ||
    rc.defaultOutput ||
    null;

  const batchSize =
    (flags['batch-size'] as number | undefined) ||
    envInt('BATCH_SIZE') ||
    rc.batchSize ||
    DEFAULTS.batchSize;

  const retrieveTimeout =
    (flags['retrieve-timeout'] as number | undefined) ||
    envInt('RETRIEVE_TIMEOUT') ||
    rc.retrieveTimeout ||
    DEFAULTS.retrieveTimeout;

  const parallelBatches =
    (flags['parallel-batches'] as number | undefined) ||
    envInt('PARALLEL_BATCHES') ||
    rc.parallelBatches ||
    DEFAULTS.parallelBatches;

  const workers =
    (flags['workers'] as number | undefined) ||
    envInt('WORKERS') ||
    rc.workers ||
    DEFAULTS.workers;

  const apiVersion =
    (flags['api-version'] as string | undefined) ||
    envStr('API_VERSION') ||
    rc.apiVersion ||
    null;

  const reportOrgOnly =
    (flags['report-org-only'] as boolean | undefined) ??
    envBool('REPORT_ORG_ONLY') ??
    rc.reportOrgOnly ??
    DEFAULTS.reportOrgOnly;

  const keepTemp =
    (flags['keep-temp'] as boolean | undefined) ??
    rc.keepTemp ??
    DEFAULTS.keepTemp;

  const dryRun =
    (flags['dry-run'] as boolean | undefined) ??
    DEFAULTS.dryRun;

  const verbose =
    (flags['verbose'] as boolean | undefined) ??
    envBool('VERBOSE') ??
    rc.verbose ??
    DEFAULTS.verbose;

  const noProgress =
    (flags['no-progress'] as boolean | undefined) ??
    false;

  const noDefaultsExclusion =
    (flags['no-defaults-exclusion'] as boolean | undefined) ??
    false;

  const includeTypesFlag = flags['include-types'] as string | undefined;
  const excludeTypesFlag = flags['exclude-types'] as string | undefined;

  const exclusionRc = rc.exclusions ?? {};
  const exclusions: ExclusionConfig = {
    useDefaults: noDefaultsExclusion ? false : (exclusionRc.useDefaults ?? true),
    additionalTypes: [
      ...(exclusionRc.additionalTypes ?? []),
      ...(excludeTypesFlag ? excludeTypesFlag.split(',').map(s => s.trim()) : []),
    ],
    includeOverride: exclusionRc.includeOverride ?? [],
  };

  const includeTypes: string[] | null = includeTypesFlag
    ? includeTypesFlag.split(',').map(s => s.trim())
    : null;

  const comparisonRc = rc.comparison ?? {};
  const comparison: ComparisonConfig = {
    xmlNormalization: comparisonRc.xmlNormalization ?? true,
    ignoreWhitespace: comparisonRc.ignoreWhitespace ?? true,
    ignoreComments: comparisonRc.ignoreComments ?? true,
    contextLines: comparisonRc.contextLines ?? 5,
    workers,
    workerMemoryMb: rc.workerMemoryMb ?? DEFAULTS.workerMemoryMb,
  };

  const htmlRc = rc.htmlReport ?? {};
  const htmlReport: HtmlReportConfig = {
    title: htmlRc.title ?? 'Salesforce Drift Report',
    theme: htmlRc.theme ?? 'light',
    includeUnchanged: htmlRc.includeUnchanged ?? false,
    syntaxHighlight: htmlRc.syntaxHighlight ?? true,
  };

  const tempDir =
    (flags['temp-dir'] as string | undefined) ||
    rc.tempDir ||
    null;

  const sourceDirFlag = flags['source-dir'] as string[] | undefined;
  const sourceDirs = sourceDirFlag ?? [];

  return {
    targetOrg,
    projectDir,
    sourceDirs,
    format,
    outputFile,
    batchSize,
    retrieveTimeout,
    parallelBatches,
    apiVersion,
    reportOrgOnly,
    exclusions,
    ignorePatterns: rc.ignorePatterns ?? [],
    comparison,
    htmlReport,
    tempDir,
    keepTemp,
    dryRun,
    verbose,
    noProgress,
    // stash includeTypes for use in scan
    ...({ includeTypes } as object),
  } as ResolvedConfig & { includeTypes: string[] | null };
}
