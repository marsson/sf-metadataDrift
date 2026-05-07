import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { compareComponent } from '../../../src/core/comparison/ComponentComparator';
import type { ComponentEntry } from '../../../src/types/ComponentTypes';
import type { ComparisonConfig } from '../../../src/types/Config';

const defaultConfig: ComparisonConfig = {
  xmlNormalization: true,
  ignoreWhitespace: true,
  ignoreComments: true,
  contextLines: 3,
  workers: 1,
  workerMemoryMb: 256,
};

let tmpDir: string;

function writeFile(relPath: string, content: string): string {
  const full = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return full;
}

function makeEntry(overrides: Partial<ComponentEntry> = {}): ComponentEntry {
  return {
    metadataType: 'ApexClass',
    apiName: 'MyClass',
    manifestKey: 'ApexClass:MyClass',
    filePaths: [],
    relativeFilePaths: [],
    ...overrides,
  };
}

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'comparator-test-'));
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('ComponentComparator', () => {

  describe('DELETED status', () => {
    it('returns DELETED when orgFilePaths is empty', async () => {
      const entry = makeEntry({ filePaths: ['/some/repo/MyClass.cls-meta.xml'] });
      const result = await compareComponent(entry, [], defaultConfig);
      assert.strictEqual(result.status, 'DELETED');
      assert.strictEqual(result.linesAdded, 0);
      assert.strictEqual(result.linesRemoved, 0);
    });
  });

  describe('UNCHANGED status', () => {
    it('returns UNCHANGED for identical XML files (node order ignored)', async () => {
      const repoXml = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
  <fullName>Budget__c</fullName>
  <type>Currency</type>
</CustomField>`;

      const orgXml = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
  <type>Currency</type>
  <fullName>Budget__c</fullName>
</CustomField>`;

      const repoFile = writeFile('repo/Budget__c.field-meta.xml', repoXml);
      const orgFile  = writeFile('org/Budget__c.field-meta.xml', orgXml);

      const entry = makeEntry({
        metadataType: 'CustomField',
        apiName: 'Account.Budget__c',
        manifestKey: 'CustomField:Account.Budget__c',
        filePaths: [repoFile],
      });

      const result = await compareComponent(entry, [orgFile], defaultConfig);
      assert.strictEqual(result.status, 'UNCHANGED');
    });

    it('returns UNCHANGED for identical non-XML files', async () => {
      const content = 'public class Foo { }';
      const repoFile = writeFile('repo/Foo.cls', content);
      const orgFile  = writeFile('org/Foo.cls', content);

      const entry = makeEntry({ filePaths: [repoFile] });
      const result = await compareComponent(entry, [orgFile], defaultConfig);
      assert.strictEqual(result.status, 'UNCHANGED');
    });
  });

  describe('CHANGED status', () => {
    it('detects a genuine XML content change', async () => {
      const repoXml = `<CustomField>
  <fullName>Budget__c</fullName>
  <scale>2</scale>
</CustomField>`;

      const orgXml = `<CustomField>
  <fullName>Budget__c</fullName>
  <scale>0</scale>
</CustomField>`;

      const repoFile = writeFile('repo2/Budget__c.field-meta.xml', repoXml);
      const orgFile  = writeFile('org2/Budget__c.field-meta.xml', orgXml);

      const entry = makeEntry({ filePaths: [repoFile] });
      const result = await compareComponent(entry, [orgFile], defaultConfig);
      assert.strictEqual(result.status, 'CHANGED');
      assert.ok(result.linesAdded + result.linesRemoved > 0);
    });

    it('detects a non-XML content change', async () => {
      const repoFile = writeFile('repo3/Foo.cls', 'public class Foo { Integer x = 1; }');
      const orgFile  = writeFile('org3/Foo.cls', 'public class Foo { Integer x = 2; }');

      const entry = makeEntry({ filePaths: [repoFile] });
      const result = await compareComponent(entry, [orgFile], defaultConfig);
      assert.strictEqual(result.status, 'CHANGED');
    });

    it('marks as changed when repo file has no org counterpart', async () => {
      const repoFile1 = writeFile('repo4/A.cls-meta.xml', '<ApexClass><apiVersion>59.0</apiVersion></ApexClass>');
      const repoFile2 = writeFile('repo4/A.cls', 'public class A {}');
      const orgFile1  = writeFile('org4/A.cls-meta.xml', '<ApexClass><apiVersion>59.0</apiVersion></ApexClass>');
      // org4/A.cls is missing

      const entry = makeEntry({ filePaths: [repoFile1, repoFile2] });
      const result = await compareComponent(entry, [orgFile1], defaultConfig);
      assert.strictEqual(result.status, 'CHANGED');
    });
  });

  describe('result metadata', () => {
    it('preserves manifestKey, metadataType, apiName', async () => {
      const repoFile = writeFile('repo5/Alpha__c.field-meta.xml', '<CustomField><fullName>Alpha__c</fullName></CustomField>');
      const orgFile  = writeFile('org5/Alpha__c.field-meta.xml', '<CustomField><fullName>Alpha__c</fullName></CustomField>');

      const entry = makeEntry({
        metadataType: 'CustomField',
        apiName: 'Account.Alpha__c',
        manifestKey: 'CustomField:Account.Alpha__c',
        filePaths: [repoFile],
      });

      const result = await compareComponent(entry, [orgFile], defaultConfig);
      assert.strictEqual(result.manifestKey, 'CustomField:Account.Alpha__c');
      assert.strictEqual(result.metadataType, 'CustomField');
      assert.strictEqual(result.apiName, 'Account.Alpha__c');
    });

    it('populates repoFilePaths and orgFilePaths', async () => {
      const repoFile = writeFile('repo6/X.cls-meta.xml', '<ApexClass><apiVersion>59.0</apiVersion></ApexClass>');
      const orgFile  = writeFile('org6/X.cls-meta.xml', '<ApexClass><apiVersion>59.0</apiVersion></ApexClass>');
      const entry = makeEntry({ filePaths: [repoFile] });

      const result = await compareComponent(entry, [orgFile], defaultConfig);
      assert.deepStrictEqual(result.repoFilePaths, [repoFile]);
      assert.deepStrictEqual(result.orgFilePaths, [orgFile]);
    });
  });

  describe('binary file skipping', () => {
    it('skips binary files and does not throw', async () => {
      const repoFile = writeFile('repo7/image.png', '\x89PNG\r\n\x1a\n');
      const orgFile  = writeFile('org7/image.png', '\x89PNG\r\n\x1a\n');

      const entry = makeEntry({ filePaths: [repoFile] });
      const result = await compareComponent(entry, [orgFile], defaultConfig);
      assert.ok(typeof result.status === 'string');
    });
  });

  describe('xmlNormalization disabled', () => {
    it('detects whitespace-only XML differences when normalization is off', async () => {
      const repoXml = '<Root>\n  <a>1</a>\n  <b>2</b>\n</Root>';
      const orgXml  = '<Root>\n  <b>2</b>\n  <a>1</a>\n</Root>';

      const repoFile = writeFile('repo8/test.xml', repoXml);
      const orgFile  = writeFile('org8/test.xml', orgXml);

      const noNorm: ComparisonConfig = { ...defaultConfig, xmlNormalization: false };
      const entry = makeEntry({ filePaths: [repoFile] });
      const result = await compareComponent(entry, [orgFile], noNorm);
      // Without normalisation, reordered nodes look different
      assert.strictEqual(result.status, 'CHANGED');
    });
  });
});
