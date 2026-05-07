import * as path from 'path';
import * as fs from 'fs';

export interface PackageDirectory {
  path: string;
  default?: boolean;
}

export interface SfdxProject {
  packageDirectories: PackageDirectory[];
  sourceApiVersion: string;
  namespace?: string;
}

export async function parseSfdxProject(projectDir: string): Promise<SfdxProject> {
  const sfdxProjectPath = path.join(projectDir, 'sfdx-project.json');

  if (!fs.existsSync(sfdxProjectPath)) {
    throw new Error(
      `sfdx-project.json not found at ${projectDir}.\n` +
      `Make sure --project-dir points to the root of your SFDX project.`
    );
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(await fs.promises.readFile(sfdxProjectPath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse sfdx-project.json: ${(err as Error).message}`);
  }

  if (!Array.isArray(raw.packageDirectories) || raw.packageDirectories.length === 0) {
    throw new Error(
      `sfdx-project.json must contain a non-empty "packageDirectories" array.`
    );
  }

  const packageDirectories = (raw.packageDirectories as PackageDirectory[]).map(pd => ({
    ...pd,
    path: path.resolve(projectDir, pd.path),
  }));

  return {
    packageDirectories,
    sourceApiVersion: (raw.sourceApiVersion as string) || '59.0',
    namespace: raw.namespace as string | undefined,
  };
}

export function getSourceDirs(project: SfdxProject, overrideDirs?: string[]): string[] {
  if (overrideDirs && overrideDirs.length > 0) {
    return overrideDirs.map(d => path.resolve(d));
  }
  return project.packageDirectories.map(pd => pd.path);
}
