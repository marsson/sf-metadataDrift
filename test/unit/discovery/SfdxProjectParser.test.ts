import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseSfdxProject, getSourceDirs } from '../../../src/core/discovery/SfdxProjectParser';

let tmpDir: string;

function writeSfdxProject(dir: string, content: object): void {
  fs.writeFileSync(path.join(dir, 'sfdx-project.json'), JSON.stringify(content), 'utf8');
}

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfdxparser-test-'));
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('SfdxProjectParser', () => {

  describe('parseSfdxProject', () => {
    it('parses a minimal valid sfdx-project.json', async () => {
      const dir = fs.mkdtempSync(path.join(tmpDir, 'proj1-'));
      writeSfdxProject(dir, {
        packageDirectories: [{ path: 'force-app', default: true }],
        sourceApiVersion: '59.0',
      });
      const project = await parseSfdxProject(dir);
      assert.strictEqual(project.sourceApiVersion, '59.0');
      assert.strictEqual(project.packageDirectories.length, 1);
    });

    it('resolves package directory paths to absolute paths', async () => {
      const dir = fs.mkdtempSync(path.join(tmpDir, 'proj2-'));
      writeSfdxProject(dir, {
        packageDirectories: [{ path: 'force-app', default: true }],
        sourceApiVersion: '59.0',
      });
      const project = await parseSfdxProject(dir);
      assert.strictEqual(project.packageDirectories[0].path, path.join(dir, 'force-app'));
    });

    it('handles multiple package directories', async () => {
      const dir = fs.mkdtempSync(path.join(tmpDir, 'proj3-'));
      writeSfdxProject(dir, {
        packageDirectories: [
          { path: 'force-app', default: true },
          { path: 'extra-package' },
        ],
        sourceApiVersion: '58.0',
      });
      const project = await parseSfdxProject(dir);
      assert.strictEqual(project.packageDirectories.length, 2);
    });

    it('defaults sourceApiVersion to 59.0 when omitted', async () => {
      const dir = fs.mkdtempSync(path.join(tmpDir, 'proj4-'));
      writeSfdxProject(dir, {
        packageDirectories: [{ path: 'force-app' }],
      });
      const project = await parseSfdxProject(dir);
      assert.strictEqual(project.sourceApiVersion, '59.0');
    });

    it('includes namespace when present', async () => {
      const dir = fs.mkdtempSync(path.join(tmpDir, 'proj5-'));
      writeSfdxProject(dir, {
        packageDirectories: [{ path: 'force-app' }],
        sourceApiVersion: '59.0',
        namespace: 'myns',
      });
      const project = await parseSfdxProject(dir);
      assert.strictEqual(project.namespace, 'myns');
    });

    it('throws when sfdx-project.json is missing', async () => {
      const dir = fs.mkdtempSync(path.join(tmpDir, 'proj6-'));
      await assert.rejects(
        () => parseSfdxProject(dir),
        /sfdx-project\.json not found/
      );
    });

    it('throws when packageDirectories is empty', async () => {
      const dir = fs.mkdtempSync(path.join(tmpDir, 'proj7-'));
      writeSfdxProject(dir, {
        packageDirectories: [],
        sourceApiVersion: '59.0',
      });
      await assert.rejects(
        () => parseSfdxProject(dir),
        /packageDirectories/
      );
    });

    it('throws when sfdx-project.json is malformed JSON', async () => {
      const dir = fs.mkdtempSync(path.join(tmpDir, 'proj8-'));
      fs.writeFileSync(path.join(dir, 'sfdx-project.json'), '{ not valid json }', 'utf8');
      await assert.rejects(
        () => parseSfdxProject(dir),
        /Failed to parse/
      );
    });
  });

  describe('getSourceDirs', () => {
    const fakeProject = {
      packageDirectories: [
        { path: '/project/force-app', default: true },
        { path: '/project/extra-pkg' },
      ],
      sourceApiVersion: '59.0',
    };

    it('returns absolute paths from packageDirectories', () => {
      const dirs = getSourceDirs(fakeProject);
      assert.deepStrictEqual(dirs, ['/project/force-app', '/project/extra-pkg']);
    });

    it('uses override dirs when provided', () => {
      const dirs = getSourceDirs(fakeProject, ['/custom/dir']);
      assert.strictEqual(dirs.length, 1);
      assert.ok(dirs[0].endsWith('custom/dir') || dirs[0].endsWith('custom' + path.sep + 'dir'));
    });

    it('returns packageDirectory paths when override is empty array', () => {
      const dirs = getSourceDirs(fakeProject, []);
      assert.deepStrictEqual(dirs, ['/project/force-app', '/project/extra-pkg']);
    });
  });
});
