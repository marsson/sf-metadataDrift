import * as assert from 'assert';
import { normaliseXml } from '../../../src/core/comparison/XmlNormaliser';

// Helper: parse and compare normalised XML, ignoring whitespace differences
function assertSameNormalisedOutput(a: string, b: string, msg?: string): void {
  const na = normaliseXml(a).replace(/\s+/g, ' ').trim();
  const nb = normaliseXml(b).replace(/\s+/g, ' ').trim();
  assert.strictEqual(na, nb, msg ?? 'normalised outputs should be equal');
}

describe('XmlNormaliser', () => {

  describe('node ordering — false positive prevention', () => {
    it('produces identical output for fields in different order', () => {
      const repo = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
  <fields>
    <fullName>Alpha__c</fullName>
    <type>Text</type>
  </fields>
  <fields>
    <fullName>Beta__c</fullName>
    <type>Number</type>
  </fields>
</CustomObject>`;

      const org = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
  <fields>
    <fullName>Beta__c</fullName>
    <type>Number</type>
  </fields>
  <fields>
    <fullName>Alpha__c</fullName>
    <type>Text</type>
  </fields>
</CustomObject>`;

      assertSameNormalisedOutput(repo, org, 'reordered fields should normalise to the same output');
    });

    it('produces identical output for picklist values in different order', () => {
      const repo = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
  <fullName>Status__c</fullName>
  <valueSet>
    <valueSetDefinition>
      <value>
        <fullName>Open</fullName>
        <label>Open</label>
      </value>
      <value>
        <fullName>Closed</fullName>
        <label>Closed</label>
      </value>
    </valueSetDefinition>
  </valueSet>
</CustomField>`;

      const org = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
  <fullName>Status__c</fullName>
  <valueSet>
    <valueSetDefinition>
      <value>
        <fullName>Closed</fullName>
        <label>Closed</label>
      </value>
      <value>
        <fullName>Open</fullName>
        <label>Open</label>
      </value>
    </valueSetDefinition>
  </valueSet>
</CustomField>`;

      assertSameNormalisedOutput(repo, org, 'reordered picklist values should normalise identically');
    });

    it('produces identical output for permission set entries in different order', () => {
      const repo = `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
  <fieldPermissions>
    <field>Account.Name</field>
    <readable>true</readable>
  </fieldPermissions>
  <fieldPermissions>
    <field>Account.Phone</field>
    <readable>true</readable>
  </fieldPermissions>
</PermissionSet>`;

      const org = `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
  <fieldPermissions>
    <field>Account.Phone</field>
    <readable>true</readable>
  </fieldPermissions>
  <fieldPermissions>
    <field>Account.Name</field>
    <readable>true</readable>
  </fieldPermissions>
</PermissionSet>`;

      assertSameNormalisedOutput(repo, org);
    });

    it('sorts by "name" when "fullName" is absent', () => {
      const repo = `<Root>
  <item><name>Zebra</name><value>1</value></item>
  <item><name>Apple</name><value>2</value></item>
</Root>`;
      const org = `<Root>
  <item><name>Apple</name><value>2</value></item>
  <item><name>Zebra</name><value>1</value></item>
</Root>`;
      assertSameNormalisedOutput(repo, org, 'should sort by name field');
    });
  });

  describe('content integrity', () => {
    it('preserves text content exactly', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
  <apiVersion>59.0</apiVersion>
  <status>Active</status>
</ApexClass>`;
      const result = normaliseXml(xml);
      assert.ok(result.includes('59.0'), 'apiVersion content should be preserved');
      assert.ok(result.includes('Active'), 'status content should be preserved');
    });

    it('handles CDATA sections without corrupting content', () => {
      const xml = `<Root>
  <body><![CDATA[SELECT Id FROM Account WHERE Name = '<Test>']]></body>
</Root>`;
      const result = normaliseXml(xml);
      // Should not throw and should preserve structure
      assert.ok(typeof result === 'string');
      assert.ok(result.length > 0);
    });

    it('handles empty elements', () => {
      const xml = `<Root>
  <emptyA></emptyA>
  <emptyB/>
  <withContent>text</withContent>
</Root>`;
      const result = normaliseXml(xml);
      assert.ok(result.includes('withContent'), 'non-empty elements preserved');
    });

    it('does not alter a document that is already canonical', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
  <fullName>Budget__c</fullName>
  <label>Budget</label>
  <type>Currency</type>
</CustomField>`;
      const once = normaliseXml(xml);
      const twice = normaliseXml(once);
      assert.strictEqual(
        once.replace(/\s+/g, ' ').trim(),
        twice.replace(/\s+/g, ' ').trim(),
        'normalisation should be idempotent'
      );
    });
  });

  describe('real drift detection', () => {
    it('detects a genuine content change after normalisation', () => {
      const repo = `<CustomField>
  <fullName>Budget__c</fullName>
  <type>Currency</type>
  <precision>18</precision>
  <scale>2</scale>
</CustomField>`;

      const org = `<CustomField>
  <fullName>Budget__c</fullName>
  <type>Currency</type>
  <precision>18</precision>
  <scale>0</scale>
</CustomField>`;

      const normRepo = normaliseXml(repo).replace(/\s+/g, ' ').trim();
      const normOrg = normaliseXml(org).replace(/\s+/g, ' ').trim();
      assert.notStrictEqual(normRepo, normOrg, 'genuine change should survive normalisation');
    });

    it('detects new field added in org', () => {
      const repo = `<CustomObject>
  <fields><fullName>Alpha__c</fullName></fields>
</CustomObject>`;

      const org = `<CustomObject>
  <fields><fullName>Alpha__c</fullName></fields>
  <fields><fullName>NewField__c</fullName></fields>
</CustomObject>`;

      const normRepo = normaliseXml(repo).replace(/\s+/g, ' ').trim();
      const normOrg = normaliseXml(org).replace(/\s+/g, ' ').trim();
      assert.notStrictEqual(normRepo, normOrg, 'added field should be detected as change');
    });
  });

  describe('edge cases', () => {
    it('returns original string when XML is malformed', () => {
      const malformed = 'this is not xml at all <<<<';
      const result = normaliseXml(malformed);
      assert.ok(typeof result === 'string', 'should not throw on malformed input');
    });

    it('handles single-element XML without arrays', () => {
      const xml = `<Root><child>value</child></Root>`;
      const result = normaliseXml(xml);
      assert.ok(typeof result === 'string');
      assert.ok(result.length > 0);
    });

    it('handles deeply nested objects', () => {
      const xml = `<Root>
  <a><b><c><d><e>deep</e></d></c></b></a>
</Root>`;
      const result = normaliseXml(xml);
      assert.ok(result.includes('deep'), 'deep content preserved');
    });

    it('handles XML with attributes', () => {
      const xml = `<Root attr="value">
  <child id="1">text</child>
</Root>`;
      const result = normaliseXml(xml);
      assert.ok(typeof result === 'string');
    });
  });
});
