export interface ComponentEntry {
  metadataType: string;
  apiName: string;
  filePaths: string[];
  relativeFilePaths: string[];
  manifestKey: string;
}

export interface FailedComponent {
  manifestKey: string;
  metadataType: string;
  apiName: string;
  error: string;
}

export interface OrgSnapshot {
  tempDir: string;
  fileIndex: Map<string, string[]>;
  retrievedAt: Date;
  batchCount: number;
  failedComponents: FailedComponent[];
}

export interface RetrieveBatch {
  id: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  componentSet: any;
  label: string;
  componentCount: number;
}
