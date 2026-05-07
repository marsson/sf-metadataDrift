export interface ExclusionConfig {
  useDefaults: boolean;
  additionalTypes: string[];
  includeOverride: string[];
}

export interface ComparisonConfig {
  xmlNormalization: boolean;
  ignoreWhitespace: boolean;
  ignoreComments: boolean;
  contextLines: number;
  workers: number;
  workerMemoryMb: number;
}

export interface HtmlReportConfig {
  title: string;
  theme: 'light' | 'dark';
  includeUnchanged: boolean;
  syntaxHighlight: boolean;
}

export interface DriftRcFile {
  $schema?: string;
  targetOrg?: string;
  defaultFormat?: 'table' | 'json' | 'html';
  defaultOutput?: string;
  batchSize?: number;
  retrieveTimeout?: number;
  parallelBatches?: number;
  workers?: number;
  workerMemoryMb?: number;
  apiVersion?: string;
  reportOrgOnly?: boolean;
  exclusions?: Partial<ExclusionConfig>;
  ignorePatterns?: string[];
  comparison?: Partial<ComparisonConfig>;
  htmlReport?: Partial<HtmlReportConfig>;
  tempDir?: string;
  keepTemp?: boolean;
  verbose?: boolean;
}

export interface ResolvedConfig {
  targetOrg: string;
  projectDir: string;
  sourceDirs: string[];
  format: 'table' | 'json' | 'html';
  outputFile: string | null;
  batchSize: number;
  retrieveTimeout: number;
  parallelBatches: number;
  apiVersion: string | null;
  reportOrgOnly: boolean;
  exclusions: ExclusionConfig;
  ignorePatterns: string[];
  comparison: ComparisonConfig;
  htmlReport: HtmlReportConfig;
  tempDir: string | null;
  keepTemp: boolean;
  dryRun: boolean;
  verbose: boolean;
  noProgress: boolean;
}

export interface ScanConfig {
  projectDir: string;
  sourceDirs: string[];
  ignorePatterns: string[];
  exclusions: ExclusionConfig;
  includeTypes: string[] | null;
  verbose: boolean;
}

export interface RetrievalConfig {
  batchSize: number;
  retrieveTimeout: number;
  parallelBatches: number;
  apiVersion: string | null;
  tempDir: string;
  verbose: boolean;
  noProgress: boolean;
}

export interface ReporterConfig {
  outputFile: string | null;
  verbose: boolean;
  htmlOptions: HtmlReportConfig;
}
