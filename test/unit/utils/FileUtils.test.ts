import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  walkDir,
  ensureDir,
  readFileUtf8,
  writeFileUtf8,
  fileExistsSync,
  makeTempDir,
  formatBytes,
  formatDuration,
  relativeFromProject,
  dirSize,
} from '../../../src/utils/FileUtils';

let tmpDir: string;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileutils-test-'));
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('FileUtils', () => {

  describe('walkDir', () => {
    it('yields all files in a flat directory', async () => {
      const dir = fs.mkdtempSync(path.join(tmpDir, 'flat-'));
      fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
      fs.writeFileSync(path.join(dir, 'b.txt'), 'b');

      const files: string[] = [];
      for await (const f of walkDir(dir)) files.push(f);

      assert.strictEqual(files.length, 2);
      assert.ok(files.some(f => f.endsWith('a.txt')));
      assert.ok(files.some(f => f.endsWith('b.txt')));
    });

    it('yields files recursively in nested directories', async () => {
      const dir = fs.mkdtempSync(path.join(tmpDir, 'nested-'));
      fs.mkdirSync(path.join(dir, 'sub'));
      fs.writeFileSync(path.join(dir, 'root.txt'), 'root');
      fs.writeFileSync(path.join(dir, 'sub', 'child.txt'), 'child');

      const files: string[] = [];
      for await (const f of walkDir(dir)) files.push(f);

      assert.strictEqual(files.length, 2);
      assert.ok(files.some(f => f.endsWith('root.txt')));
      assert.ok(files.some(f => f.endsWith('child.txt')));
    });

    it('yields nothing for an empty directory', async () => {
      const dir = fs.mkdtempSync(path.join(tmpDir, 'empty-'));
      const files: string[] = [];
      for await (const f of walkDir(dir)) files.push(f);
      assert.strictEqual(files.length, 0);
    });

    it('does not throw for a non-existent directory', async () => {
      const files: string[] = [];
      for await (const f of walkDir('/non/existent/path/xyz')) files.push(f);
      assert.strictEqual(files.length, 0);
    });
  });

  describe('ensureDir', () => {
    it('creates a new directory', async () => {
      const dir = path.join(tmpDir, 'newdir', 'nested');
      await ensureDir(dir);
      assert.ok(fs.existsSync(dir));
    });

    it('does not throw if directory already exists', async () => {
      const dir = path.join(tmpDir, 'existing-dir');
      fs.mkdirSync(dir, { recursive: true });
      await assert.doesNotReject(() => ensureDir(dir));
    });
  });

  describe('readFileUtf8 / writeFileUtf8', () => {
    it('writes and reads back a file', async () => {
      const filePath = path.join(tmpDir, 'rw-test.txt');
      await writeFileUtf8(filePath, 'hello world');
      const content = await readFileUtf8(filePath);
      assert.strictEqual(content, 'hello world');
    });

    it('preserves Unicode content', async () => {
      const filePath = path.join(tmpDir, 'unicode.txt');
      const text = 'こんにちは 🌍';
      await writeFileUtf8(filePath, text);
      const content = await readFileUtf8(filePath);
      assert.strictEqual(content, text);
    });
  });

  describe('fileExistsSync', () => {
    it('returns true for an existing file', () => {
      const filePath = path.join(tmpDir, 'exists.txt');
      fs.writeFileSync(filePath, '');
      assert.strictEqual(fileExistsSync(filePath), true);
    });

    it('returns false for a non-existent file', () => {
      assert.strictEqual(fileExistsSync(path.join(tmpDir, 'nonexistent.txt')), false);
    });
  });

  describe('makeTempDir', () => {
    it('creates a temporary directory with the given prefix', () => {
      const dir = makeTempDir('test-prefix-');
      try {
        assert.ok(fs.existsSync(dir));
        assert.ok(path.basename(dir).startsWith('test-prefix-'));
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('creates unique directories on each call', () => {
      const dir1 = makeTempDir('uniq-');
      const dir2 = makeTempDir('uniq-');
      try {
        assert.notStrictEqual(dir1, dir2);
      } finally {
        fs.rmSync(dir1, { recursive: true, force: true });
        fs.rmSync(dir2, { recursive: true, force: true });
      }
    });
  });

  describe('formatBytes', () => {
    it('formats bytes under 1 KB', () => {
      assert.strictEqual(formatBytes(512), '512 B');
    });

    it('formats kilobytes', () => {
      assert.strictEqual(formatBytes(1536), '1.5 KB');
    });

    it('formats megabytes', () => {
      assert.ok(formatBytes(1048576).includes('MB'));
    });

    it('formats 0 bytes', () => {
      assert.strictEqual(formatBytes(0), '0 B');
    });
  });

  describe('formatDuration', () => {
    it('formats milliseconds under 1 second', () => {
      assert.strictEqual(formatDuration(500), '500ms');
    });

    it('formats seconds under 1 minute', () => {
      assert.strictEqual(formatDuration(2500), '2.5s');
    });

    it('formats minutes and seconds', () => {
      const result = formatDuration(90_000);
      assert.ok(result.includes('1m'), `expected minutes in: ${result}`);
      assert.ok(result.includes('30s'), `expected seconds in: ${result}`);
    });

    it('formats exactly 1 second', () => {
      assert.strictEqual(formatDuration(1000), '1.0s');
    });
  });

  describe('relativeFromProject', () => {
    it('returns a relative path from projectDir', () => {
      const rel = relativeFromProject('/project/force-app/classes/Foo.cls', '/project');
      assert.strictEqual(rel, path.join('force-app', 'classes', 'Foo.cls'));
    });

    it('returns just the filename when file is directly in projectDir', () => {
      const rel = relativeFromProject('/project/sfdx-project.json', '/project');
      assert.strictEqual(rel, 'sfdx-project.json');
    });
  });

  describe('dirSize', () => {
    it('returns the total size of files in a directory', async () => {
      const dir = fs.mkdtempSync(path.join(tmpDir, 'size-'));
      fs.writeFileSync(path.join(dir, 'a.txt'), 'hello');  // 5 bytes
      fs.writeFileSync(path.join(dir, 'b.txt'), 'world!'); // 6 bytes

      const size = await dirSize(dir);
      assert.strictEqual(size, 11);
    });

    it('returns 0 for an empty directory', async () => {
      const dir = fs.mkdtempSync(path.join(tmpDir, 'empty-size-'));
      const size = await dirSize(dir);
      assert.strictEqual(size, 0);
    });

    it('returns 0 for a non-existent directory without throwing', async () => {
      const size = await dirSize('/non/existent/dir/xyz');
      assert.strictEqual(size, 0);
    });
  });
});
