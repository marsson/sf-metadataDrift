import * as assert from 'assert';
import {
  DEFAULT_EXCLUDED_TYPES,
  METADATA_FILE_SUFFIXES,
  DECOMPOSED_CHILD_DIRS,
  resolveExcludedTypes,
} from '../../../src/utils/MetadataTypeMap';

describe('MetadataTypeMap', () => {

  describe('DEFAULT_EXCLUDED_TYPES', () => {
    it('excludes Profile by default', () => {
      assert.ok(DEFAULT_EXCLUDED_TYPES.has('Profile'));
    });

    it('excludes PermissionSet by default', () => {
      assert.ok(DEFAULT_EXCLUDED_TYPES.has('PermissionSet'));
    });

    it('excludes Settings by default', () => {
      assert.ok(DEFAULT_EXCLUDED_TYPES.has('Settings'));
    });

    it('does not exclude ApexClass', () => {
      assert.ok(!DEFAULT_EXCLUDED_TYPES.has('ApexClass'));
    });

    it('does not exclude Flow', () => {
      assert.ok(!DEFAULT_EXCLUDED_TYPES.has('Flow'));
    });
  });

  describe('METADATA_FILE_SUFFIXES', () => {
    it('maps .cls-meta.xml to ApexClass', () => {
      assert.strictEqual(METADATA_FILE_SUFFIXES.get('.cls-meta.xml'), 'ApexClass');
    });

    it('maps .field-meta.xml to CustomField', () => {
      assert.strictEqual(METADATA_FILE_SUFFIXES.get('.field-meta.xml'), 'CustomField');
    });

    it('maps .object-meta.xml to CustomObject', () => {
      assert.strictEqual(METADATA_FILE_SUFFIXES.get('.object-meta.xml'), 'CustomObject');
    });

    it('maps .flow-meta.xml to Flow', () => {
      assert.strictEqual(METADATA_FILE_SUFFIXES.get('.flow-meta.xml'), 'Flow');
    });

    it('maps .permissionset-meta.xml to PermissionSet', () => {
      assert.strictEqual(METADATA_FILE_SUFFIXES.get('.permissionset-meta.xml'), 'PermissionSet');
    });

    it('maps .validationRule-meta.xml to ValidationRule', () => {
      assert.strictEqual(METADATA_FILE_SUFFIXES.get('.validationRule-meta.xml'), 'ValidationRule');
    });

    it('maps .layout-meta.xml to Layout', () => {
      assert.strictEqual(METADATA_FILE_SUFFIXES.get('.layout-meta.xml'), 'Layout');
    });

    it('has a non-trivial number of suffix mappings', () => {
      assert.ok(METADATA_FILE_SUFFIXES.size >= 20, `only ${METADATA_FILE_SUFFIXES.size} suffixes defined`);
    });
  });

  describe('DECOMPOSED_CHILD_DIRS', () => {
    it('maps "fields" to CustomField', () => {
      assert.strictEqual(DECOMPOSED_CHILD_DIRS.get('fields'), 'CustomField');
    });

    it('maps "validationRules" to ValidationRule', () => {
      assert.strictEqual(DECOMPOSED_CHILD_DIRS.get('validationRules'), 'ValidationRule');
    });

    it('maps "listViews" to ListView', () => {
      assert.strictEqual(DECOMPOSED_CHILD_DIRS.get('listViews'), 'ListView');
    });

    it('maps "recordTypes" to RecordType', () => {
      assert.strictEqual(DECOMPOSED_CHILD_DIRS.get('recordTypes'), 'RecordType');
    });

    it('maps "compactLayouts" to CompactLayout', () => {
      assert.strictEqual(DECOMPOSED_CHILD_DIRS.get('compactLayouts'), 'CompactLayout');
    });

    it('does not map "objects"', () => {
      assert.strictEqual(DECOMPOSED_CHILD_DIRS.get('objects'), undefined);
    });
  });

  describe('resolveExcludedTypes', () => {
    it('includes default types when useDefaults=true', () => {
      const excluded = resolveExcludedTypes(true, [], []);
      assert.ok(excluded.has('Profile'));
      assert.ok(excluded.has('PermissionSet'));
    });

    it('excludes no default types when useDefaults=false', () => {
      const excluded = resolveExcludedTypes(false, [], []);
      assert.ok(!excluded.has('Profile'));
      assert.ok(!excluded.has('PermissionSet'));
    });

    it('adds additional types from the additionalTypes list', () => {
      const excluded = resolveExcludedTypes(false, ['Flow', 'ApexClass'], []);
      assert.ok(excluded.has('Flow'));
      assert.ok(excluded.has('ApexClass'));
    });

    it('removes types from exclusion when in includeOverride', () => {
      const excluded = resolveExcludedTypes(true, [], ['Profile']);
      assert.ok(!excluded.has('Profile'), 'Profile should be removed by includeOverride');
      assert.ok(excluded.has('PermissionSet'), 'PermissionSet should still be excluded');
    });

    it('includeOverride takes precedence over both defaults and additional', () => {
      const excluded = resolveExcludedTypes(true, ['Flow'], ['Flow', 'Profile']);
      assert.ok(!excluded.has('Flow'));
      assert.ok(!excluded.has('Profile'));
    });

    it('returns empty set with no defaults and no additional types', () => {
      const excluded = resolveExcludedTypes(false, [], []);
      assert.strictEqual(excluded.size, 0);
    });
  });
});
