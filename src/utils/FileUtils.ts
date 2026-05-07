import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export async function* walkDir(dir: string): AsyncGenerator<string> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(fullPath);
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

export async function removeDirRecursive(dirPath: string): Promise<void> {
  await fs.promises.rm(dirPath, { recursive: true, force: true });
}

export async function readFileUtf8(filePath: string): Promise<string> {
  return fs.promises.readFile(filePath, 'utf8');
}

export function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function fileExistsSync(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function writeFileUtf8(filePath: string, content: string): Promise<void> {
  await fs.promises.writeFile(filePath, content, 'utf8');
}

export function relativeFromProject(absolutePath: string, projectDir: string): string {
  return path.relative(projectDir, absolutePath);
}

export async function dirSize(dirPath: string): Promise<number> {
  let size = 0;
  try {
    for await (const file of walkDir(dirPath)) {
      const stat = await fs.promises.stat(file);
      size += stat.size;
    }
  } catch {
    // ignore
  }
  return size;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}
