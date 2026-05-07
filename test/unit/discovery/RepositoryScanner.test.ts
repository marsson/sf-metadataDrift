import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { RepositoryScanner } from '../../../src/core/discovery/RepositoryScanner';
import type { ScanConfig } from '../../../src/types/Config';

let tmpDir: string;

function writeFile(root: string, relPath: string, content = ''): string {
  const full = path.join(root, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return full;
}

function makeConfig(projectDir: string, overrides: Partial<ScanConfig> = {}): ScanConfig {
  return {
    projectDir,
    sourceDirs: [],
    verbose: false,
    ignorePatterns: [],
    includeTypes: null,
    exclusions: {
      useDefaults: false,
      additionalTypes: [],
      includeOverride: [],
    },
    ...overrides,
  };
}

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reposcanner-test-'));
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('RepositoryScanner', () => {

  describe('basic scanning', () => {
    it('registers an ApexClass from a -meta.xml file', async () => {
      const root = fs.mkdtempSync(path.join(tmpDir, 'proj1-'));
      const pkgDir = path.join(root, 'force-app');
      writeFile(root, 'force-app/main/default/classes/MyClass.cls-meta.xml',
        '<ApexClass><apiVersion>59.0</apiVersion></ApexClass>');

      const scanner = new RepositoryScanner();
      const registry = await scanner.scan([pkgDir], makeConfig(root));

      assert.ok(registry.has('ApexClass:MyClass'), 'should find ApexClass:MyClass');
    });

    it('registers a CustomField with the parent object in the API name', async () => {
      const root = fs.mkdtempSync(path.join(tmpDir, 'proj2-'));
      const pkgDir = path.join(root, 'force-app');
      writeFile(root, 'force-app/main/default/objects/Account/fields/Budget__c.field-meta.xml', '');

      const scanner = new RepositoryScanner();
      const registry = await scanner.scan([pkgDir], makeConfig(root));

      assert.ok(registry.has('CustomField:Account.Budget__c'), 'should find CustomField:Account.Budget__c');
    });

    it('registers both .cls and .cls-meta.xml under the same manifestKey', async () => {
      const root = fs.mkdtempSync(path.join(tmpDir, 'proj3-'));
      const pkgDir = path.join(root, 'force-app');
      writeFile(root, 'force-app/main/default/classes/Foo.cls', 'public class Foo {}');
      writeFile(root, 'force-app/main/default/classes/Foo.cls-meta.xml',
        '<ApexClass><apiVersion>59.0</apiVersion></ApexClass>');

      const scanner = new RepositoryScanner();
      const registry = await scanner.scan([pkgDir], makeConfig(root));

      const entry = registry.get('ApexClass:Foo');
      assert.ok(entry, 'should find ApexClass:Foo');
      assert.strictEqual(entry.filePaths.length, 2, 'should have 2 file paths');
    });

    it('scans multiple package directories', async () => {
      const root = fs.mkdtempSync(path.join(tmpDir, 'proj4-'));
      const pkgDir1 = path.join(root, 'force-app');
      const pkgDir2 = path.join(root, 'extra-pkg');
      writeFile(root, 'force-app/main/default/classes/ClassA.cls-meta.xml', '');
      writeFile(root, 'extra-pkg/main/default/classes/ClassB.cls-meta.xml', '');

      const scanner = new RepositoryScanner();
      const registry = await scanner.scan([pkgDir1, pkgDir2], makeConfig(root));

      assert.ok(registry.has('ApexClass:ClassA'));
      assert.ok(registry.has('ApexClass:ClassB'));
    });

    it('returns empty registry for empty directory', async () => {
      const root = fs.mkdtempSync(path.join(tmpDir, 'proj5-'));
      const pkgDir = path.join(root, 'force-app');
      fs.mkdirSync(pkgDir, { recursive: true });

      const scanner = new RepositoryScanner();
      const registry = await scanner.scan([pkgDir], makeConfig(root));
      assert.strictEqual(registry.size, 0);
    });
  });

  describe('type exclusions', () => {
    it('excludes default types when useDefaults=true', async () => {
      const root = fs.mkdtempSync(path.join(tmpDir, 'proj6-'));
      const pkgDir = path.join(root, 'force-app');
      writeFile(root, 'force-app/main/default/profiles/Admin.profile-meta.xml', '');
      writeFile(root, 'force-app/main/default/classes/MyClass.cls-meta.xml', '');

      const scanner = new RepositoryScanner();
      const registry = await scanner.scan([pkgDir], makeConfig(root, {
        exclusions: { useDefaults: true, additionalTypes: [], includeOverride: [] },
      }));

      assert.ok(!registry.has('Profile:Admin'), 'Profile should be excluded by defaults');
      assert.ok(registry.has('ApexClass:MyClass'), 'ApexClass should still be included');
    });

    it('excludes additional types specified in config', async () => {
      const root = fs.mkdtempSync(path.join(tmpDir, 'proj7-'));
      const pkgDir = path.join(root, 'force-app');
      writeFile(root, 'force-app/main/default/flows/MyFlow.flow-meta.xml', '');
      writeFile(root, 'force-app/main/default/classes/MyClass.cls-meta.xml', '');

      const scanner = new RepositoryScanner();
      const registry = await scanner.scan([pkgDir], makeConfig(root, {
        exclusions: { useDefaults: false, additionalTypes: ['Flow'], includeOverride: [] },
      }));

      assert.ok(!registry.has('Flow:MyFlow'), 'Flow should be excluded');
      assert.ok(registry.has('ApexClass:MyClass'), 'ApexClass should still be included');
    });
  });

  describe('includeTypes filter', () => {
    it('only includes specified types', async () => {
      const root = fs.mkdtempSync(path.join(tmpDir, 'proj8-'));
      const pkgDir = path.join(root, 'force-app');
      writeFile(root, 'force-app/main/default/classes/MyClass.cls-meta.xml', '');
      writeFile(root, 'force-app/main/default/flows/MyFlow.flow-meta.xml', '');

      const scanner = new RepositoryScanner();
      const registry = await scanner.scan([pkgDir], makeConfig(root, {
        includeTypes: ['ApexClass'],
      }));

      assert.ok(registry.has('ApexClass:MyClass'));
      assert.ok(!registry.has('Flow:MyFlow'));
    });
  });

  describe('ignorePatterns', () => {
    it('skips files matching an ignore pattern', async () => {
      const root = fs.mkdtempSync(path.join(tmpDir, 'proj9-'));
      const pkgDir = path.join(root, 'force-app');
      writeFile(root, 'force-app/main/default/classes/Test_Util.cls-meta.xml', '');
      writeFile(root, 'force-app/main/default/classes/RealClass.cls-meta.xml', '');

      const scanner = new RepositoryScanner();
      const registry = await scanner.scan([pkgDir], makeConfig(root, {
        ignorePatterns: ['**/classes/Test_*'],
      }));

      assert.ok(!registry.has('ApexClass:Test_Util'), 'should be ignored by pattern');
      assert.ok(registry.has('ApexClass:RealClass'), 'should not be ignored');
    });
  });

  describe('unknown/non-metadata files', () => {
    it('does not register README.md or package.json', async () => {
      const root = fs.mkdtempSync(path.join(tmpDir, 'proj10-'));
      const pkgDir = path.join(root, 'force-app');
      writeFile(root, 'force-app/README.md', '# project');
      writeFile(root, 'force-app/package.json', '{}');

      const scanner = new RepositoryScanner();
      const registry = await scanner.scan([pkgDir], makeConfig(root));
      assert.strictEqual(registry.size, 0);
    });
  });
});
