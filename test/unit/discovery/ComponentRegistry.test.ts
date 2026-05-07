import * as assert from 'assert';
import { ComponentRegistry } from '../../../src/core/discovery/ComponentRegistry';
import type { ComponentEntry } from '../../../src/types/ComponentTypes';

function makeEntry(type: string, apiName: string, files: string[] = []): ComponentEntry {
  return {
    metadataType: type,
    apiName,
    manifestKey: `${type}:${apiName}`,
    filePaths: files.length ? files : [`/repo/${type}/${apiName}.xml`],
    relativeFilePaths: files.length ? files.map(f => f.replace('/repo/', '')) : [`${type}/${apiName}.xml`],
  };
}

describe('ComponentRegistry', () => {

  describe('add and get', () => {
    it('stores and retrieves an entry by manifestKey', () => {
      const reg = new ComponentRegistry();
      const entry = makeEntry('ApexClass', 'MyClass');
      reg.add(entry);
      const retrieved = reg.get('ApexClass:MyClass');
      assert.ok(retrieved);
      assert.strictEqual(retrieved.apiName, 'MyClass');
    });

    it('returns undefined for missing keys', () => {
      const reg = new ComponentRegistry();
      assert.strictEqual(reg.get('ApexClass:Missing'), undefined);
    });
  });

  describe('has', () => {
    it('returns true for an existing key', () => {
      const reg = new ComponentRegistry();
      reg.add(makeEntry('Flow', 'MyFlow'));
      assert.strictEqual(reg.has('Flow:MyFlow'), true);
    });

    it('returns false for a non-existent key', () => {
      const reg = new ComponentRegistry();
      assert.strictEqual(reg.has('Flow:Missing'), false);
    });
  });

  describe('size', () => {
    it('starts at zero', () => {
      assert.strictEqual(new ComponentRegistry().size, 0);
    });

    it('increments with unique entries', () => {
      const reg = new ComponentRegistry();
      reg.add(makeEntry('ApexClass', 'A'));
      reg.add(makeEntry('ApexClass', 'B'));
      assert.strictEqual(reg.size, 2);
    });

    it('does not increment for duplicate keys', () => {
      const reg = new ComponentRegistry();
      reg.add(makeEntry('ApexClass', 'A'));
      reg.add(makeEntry('ApexClass', 'A'));
      assert.strictEqual(reg.size, 1);
    });
  });

  describe('duplicate merging', () => {
    it('merges filePaths for duplicate manifestKey', () => {
      const reg = new ComponentRegistry();
      reg.add(makeEntry('ApexClass', 'A', ['/repo/A.cls-meta.xml']));
      reg.add(makeEntry('ApexClass', 'A', ['/repo/A.cls']));
      const entry = reg.get('ApexClass:A')!;
      assert.strictEqual(entry.filePaths.length, 2);
      assert.ok(entry.filePaths.includes('/repo/A.cls-meta.xml'));
      assert.ok(entry.filePaths.includes('/repo/A.cls'));
    });

    it('does not duplicate identical filePaths', () => {
      const reg = new ComponentRegistry();
      reg.add(makeEntry('ApexClass', 'A', ['/repo/A.cls']));
      reg.add(makeEntry('ApexClass', 'A', ['/repo/A.cls']));
      const entry = reg.get('ApexClass:A')!;
      assert.strictEqual(entry.filePaths.length, 1);
    });
  });

  describe('toArray', () => {
    it('returns all entries as an array', () => {
      const reg = new ComponentRegistry();
      reg.add(makeEntry('ApexClass', 'A'));
      reg.add(makeEntry('CustomField', 'Account.Name__c'));
      const arr = reg.toArray();
      assert.strictEqual(arr.length, 2);
    });

    it('returns empty array for empty registry', () => {
      assert.deepStrictEqual(new ComponentRegistry().toArray(), []);
    });
  });

  describe('byType', () => {
    it('groups entries by metadata type', () => {
      const reg = new ComponentRegistry();
      reg.add(makeEntry('ApexClass', 'A'));
      reg.add(makeEntry('ApexClass', 'B'));
      reg.add(makeEntry('Flow', 'MyFlow'));
      const map = reg.byType();
      assert.strictEqual(map.get('ApexClass')?.length, 2);
      assert.strictEqual(map.get('Flow')?.length, 1);
    });
  });

  describe('filterByTypes', () => {
    it('excludes specified types', () => {
      const reg = new ComponentRegistry();
      reg.add(makeEntry('ApexClass', 'A'));
      reg.add(makeEntry('Profile', 'Admin'));
      reg.add(makeEntry('Flow', 'F'));
      const filtered = reg.filterByTypes(null, new Set(['Profile']));
      assert.strictEqual(filtered.size, 2);
      assert.strictEqual(filtered.has('Profile:Admin'), false);
    });

    it('includes only specified types when include list is provided', () => {
      const reg = new ComponentRegistry();
      reg.add(makeEntry('ApexClass', 'A'));
      reg.add(makeEntry('Flow', 'F'));
      reg.add(makeEntry('CustomField', 'Account.X__c'));
      const filtered = reg.filterByTypes(['ApexClass'], new Set());
      assert.strictEqual(filtered.size, 1);
      assert.strictEqual(filtered.has('ApexClass:A'), true);
    });

    it('returns empty registry when all types excluded', () => {
      const reg = new ComponentRegistry();
      reg.add(makeEntry('Profile', 'Admin'));
      const filtered = reg.filterByTypes(null, new Set(['Profile']));
      assert.strictEqual(filtered.size, 0);
    });

    it('returns original entries when no filters applied', () => {
      const reg = new ComponentRegistry();
      reg.add(makeEntry('ApexClass', 'A'));
      reg.add(makeEntry('Flow', 'F'));
      const filtered = reg.filterByTypes(null, new Set());
      assert.strictEqual(filtered.size, 2);
    });
  });

  describe('typeCount and typeSummary', () => {
    it('typeCount returns accurate counts per type', () => {
      const reg = new ComponentRegistry();
      reg.add(makeEntry('ApexClass', 'A'));
      reg.add(makeEntry('ApexClass', 'B'));
      reg.add(makeEntry('Flow', 'F'));
      const counts = reg.typeCount();
      assert.strictEqual(counts.get('ApexClass'), 2);
      assert.strictEqual(counts.get('Flow'), 1);
    });

    it('typeSummary returns a non-empty string for populated registry', () => {
      const reg = new ComponentRegistry();
      reg.add(makeEntry('ApexClass', 'A'));
      const summary = reg.typeSummary();
      assert.ok(typeof summary === 'string');
      assert.ok(summary.length > 0);
    });
  });
});
