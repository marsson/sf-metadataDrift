export type DriftStatus = 'CHANGED' | 'DELETED' | 'ORG_ONLY' | 'UNCHANGED';

export interface DiffLine {
  type: 'context' | 'added' | 'removed';
  lineNumber: {
    repo: number | null;
    org: number | null;
  };
  content: string;
}

export interface DiffHunk {
  repoStartLine: number;
  orgStartLine: number;
  repoLineCount: number;
  orgLineCount: number;
  lines: DiffLine[];
}

export interface DriftResult {
  manifestKey: string;
  metadataType: string;
  apiName: string;
  status: DriftStatus;
  repoFilePaths: string[];
  orgFilePaths: string[];
  linesAdded: number;
  linesRemoved: number;
  hunks: DiffHunk[];
}

export interface ReportMeta {
  generatedAt: string;
  apiVersion: string;
  orgId: string;
  orgAlias: string;
  projectDir: string;
  scanDurationMs: number;
  toolVersion: string;
}

export interface ReportSummary {
  totalScanned: number;
  totalDrifted: number;
  changed: number;
  deleted: number;
  orgOnly: number;
  unchanged: number;
}

export interface DriftReport {
  meta: ReportMeta;
  summary: ReportSummary;
  components: DriftResult[];
}
