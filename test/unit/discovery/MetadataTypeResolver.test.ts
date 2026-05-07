import * as assert from 'assert';
import * as path from 'path';
import { resolveFromPath, isMetadataFile } from '../../../src/core/discovery/MetadataTypeResolver';

const PROJECT_ROOT = '/project';

function resolve(relPath: string) {
  return resolveFromPath(path.join(PROJECT_ROOT, relPath), PROJECT_ROOT);
}

describe('MetadataTypeResolver', () => {

  describe('resolveFromPath — decomposed object children', () => {
    it('resolves a CustomField inside an Account object folder', () => {
      const result = resolve('force-app/main/default/objects/Account/fields/Budget__c.field-meta.xml');
      assert.ok(result);
      assert.strictEqual(result.metadataType, 'CustomField');
      assert.strictEqual(result.apiName, 'Account.Budget__c');
    });

    it('resolves a ValidationRule inside an object folder', () => {
      const result = resolve('force-app/main/default/objects/Opportunity/validationRules/RequireCloseDate.validationRule-meta.xml');
      assert.ok(result);
      assert.strictEqual(result.metadataType, 'ValidationRule');
      assert.strictEqual(result.apiName, 'Opportunity.RequireCloseDate');
    });

    it('resolves a ListView', () => {
      const result = resolve('force-app/main/default/objects/Contact/listViews/AllContacts.listView-meta.xml');
      assert.ok(result);
      assert.strictEqual(result.metadataType, 'ListView');
      assert.strictEqual(result.apiName, 'Contact.AllContacts');
    });

    it('resolves a RecordType', () => {
      const result = resolve('force-app/main/default/objects/Lead/recordTypes/Hot.recordType-meta.xml');
      assert.ok(result);
      assert.strictEqual(result.metadataType, 'RecordType');
      assert.strictEqual(result.apiName, 'Lead.Hot');
    });

    it('resolves a CompactLayout', () => {
      const result = resolve('force-app/main/default/objects/Account/compactLayouts/DefaultLayout.compactLayout-meta.xml');
      assert.ok(result);
      assert.strictEqual(result.metadataType, 'CompactLayout');
      assert.strictEqual(result.apiName, 'Account.DefaultLayout');
    });

    it('resolves a FieldSet', () => {
      const result = resolve('force-app/main/default/objects/Account/fieldSets/Basic.fieldSet-meta.xml');
      assert.ok(result);
      assert.strictEqual(result.metadataType, 'FieldSet');
      assert.strictEqual(result.apiName, 'Account.Basic');
    });

    it('handles custom object names with double underscores', () => {
      const result = resolve('force-app/main/default/objects/My_Custom__c/fields/Status__c.field-meta.xml');
      assert.ok(result);
      assert.strictEqual(result.metadataType, 'CustomField');
      assert.strictEqual(result.apiName, 'My_Custom__c.Status__c');
    });
  });

  describe('resolveFromPath — CustomObject root file', () => {
    it('resolves CustomObject root meta file', () => {
      const result = resolve('force-app/main/default/objects/Account/Account.object-meta.xml');
      assert.ok(result);
      assert.strictEqual(result.metadataType, 'CustomObject');
      assert.strictEqual(result.apiName, 'Account');
    });

    it('resolves custom object meta file', () => {
      const result = resolve('force-app/main/default/objects/My_Object__c/My_Object__c.object-meta.xml');
      assert.ok(result);
      assert.strictEqual(result.metadataType, 'CustomObject');
      assert.strictEqual(result.apiName, 'My_Object__c');
    });
  });

  describe('resolveFromPath — Apex types', () => {
    it('resolves ApexClass -meta.xml file', () => {
      const result = resolve('force-app/main/default/classes/MyClass.cls-meta.xml');
      assert.ok(result);
      assert.strictEqual(result.metadataType, 'ApexClass');
      assert.strictEqual(result.apiName, 'MyClass');
    });

    it('resolves ApexClass .cls paired file', () => {
      const result = resolve('force-app/main/default/classes/MyClass.cls');
      assert.ok(result);
      assert.strictEqual(result.metadataType, 'ApexClass');
      assert.strictEqual(result.apiName, 'MyClass');
    });

    it('resolves ApexTrigger -meta.xml file', () => {
      const result = resolve('force-app/main/default/triggers/AccountTrigger.trigger-meta.xml');
      assert.ok(result);
      assert.strictEqual(result.metadataType, 'ApexTrigger');
      assert.strictEqual(result.apiName, 'AccountTrigger');
    });

    it('resolves ApexTrigger .trigger paired file', () => {
      const result = resolve('force-app/main/default/triggers/AccountTrigger.trigger');
      assert.ok(result);
      assert.strictEqual(result.metadataType, 'ApexTrigger');
      assert.strictEqual(result.apiName, 'AccountTrigger');
    });
  });

  describe('resolveFromPath — common metadata types', () => {
    it('resolves a Flow', () => {
      const result = resolve('force-app/main/default/flows/MyFlow.flow-meta.xml');
      assert.ok(result);
      assert.strictEqual(result.metadataType, 'Flow');
      assert.strictEqual(result.apiName, 'MyFlow');
    });

    it('resolves a Layout', () => {
      const result = resolve('force-app/main/default/layouts/Account-Account_Layout.layout-meta.xml');
      assert.ok(result);
      assert.strictEqual(result.metadataType, 'Layout');
      assert.strictEqual(result.apiName, 'Account-Account_Layout');
    });

    it('resolves a PermissionSet', () => {
      const result = resolve('force-app/main/default/permissionsets/Admin.permissionset-meta.xml');
      assert.ok(result);
      assert.strictEqual(result.metadataType, 'PermissionSet');
      assert.strictEqual(result.apiName, 'Admin');
    });

    it('resolves a FlexiPage', () => {
      const result = resolve('force-app/main/default/flexipages/HomePage.flexipage-meta.xml');
      assert.ok(result);
      assert.strictEqual(result.metadataType, 'FlexiPage');
      assert.strictEqual(result.apiName, 'HomePage');
    });

    it('resolves a StaticResource', () => {
      const result = resolve('force-app/main/default/staticresources/myLib.resource-meta.xml');
      assert.ok(result);
      assert.strictEqual(result.metadataType, 'StaticResource');
      assert.strictEqual(result.apiName, 'myLib');
    });

    it('resolves CustomLabels', () => {
      const result = resolve('force-app/main/default/labels/CustomLabels.labels-meta.xml');
      assert.ok(result);
      assert.strictEqual(result.metadataType, 'CustomLabels');
      assert.strictEqual(result.apiName, 'CustomLabels');
    });
  });

  describe('resolveFromPath — LWC', () => {
    it('resolves an LWC from its js-meta.xml file', () => {
      const result = resolve('force-app/main/default/lwc/myComponent/myComponent.js-meta.xml');
      assert.ok(result);
      assert.strictEqual(result.metadataType, 'LightningComponentBundle');
      assert.strictEqual(result.apiName, 'myComponent');
    });
  });

  describe('resolveFromPath — returns null for unknown files', () => {
    it('returns null for a random .json file', () => {
      const result = resolve('force-app/main/default/config/some.json');
      assert.strictEqual(result, null);
    });

    it('returns null for a .gitignore file', () => {
      const result = resolve('.gitignore');
      assert.strictEqual(result, null);
    });

    it('returns null for a plain .xml file with no suffix match', () => {
      const result = resolve('force-app/main/default/config/custom.xml');
      assert.strictEqual(result, null);
    });
  });

  describe('isMetadataFile', () => {
    it('returns true for .cls-meta.xml', () => {
      assert.strictEqual(isMetadataFile('/project/classes/MyClass.cls-meta.xml'), true);
    });

    it('returns true for .field-meta.xml', () => {
      assert.strictEqual(isMetadataFile('/project/objects/Account/fields/X.field-meta.xml'), true);
    });

    it('returns true for .cls paired file', () => {
      assert.strictEqual(isMetadataFile('/project/classes/MyClass.cls'), true);
    });

    it('returns false for a .json file', () => {
      assert.strictEqual(isMetadataFile('/project/config/package.json'), false);
    });

    it('returns false for a .ts file', () => {
      assert.strictEqual(isMetadataFile('/project/src/index.ts'), false);
    });
  });
});
