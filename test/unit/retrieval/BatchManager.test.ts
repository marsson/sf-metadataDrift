import * as assert from 'assert';
import { BatchManager } from '../../../src/core/retrieval/BatchManager';
import { ComponentRegistry } from '../../../src/core/discovery/ComponentRegistry';
import type { ComponentEntry } from '../../../src/types/ComponentTypes';

function makeEntry(type: string, apiName: string): ComponentEntry {
  return {
    metadataType: type,
    apiName,
    manifestKey: `${type}:${apiName}`,
    filePaths: [`/repo/${type}/${apiName}.xml`],
    relativeFilePaths: [`${type}/${apiName}.xml`],
  };
}

function buildRegistry(...entries: ComponentEntry[]): ComponentRegistry {
  const reg = new ComponentRegistry();
  for (const e of entries) reg.add(e);
  return reg;
}

describe('BatchManager', () => {

  describe('createBatches — basic chunking', () => {
    it('creates a single batch when components fit in one batch', () => {
      const reg = buildRegistry(
        makeEntry('ApexClass', 'A'),
        makeEntry('ApexClass', 'B'),
      );
      const batches = new BatchManager().createBatches(reg, 10);
      assert.strictEqual(batches.length, 1);
    });

    it('creates multiple batches when components exceed batchSize', () => {
      const reg = new ComponentRegistry();
      for (let i = 0; i < 25; i++) reg.add(makeEntry('ApexClass', `Class${i}`));
      const batches = new BatchManager().createBatches(reg, 10);
      assert.strictEqual(batches.length, 3); // 10 + 10 + 5
    });

    it('returns empty array for empty registry', () => {
      const reg = new ComponentRegistry();
      const batches = new BatchManager().createBatches(reg, 10);
      assert.deepStrictEqual(batches, []);
    });
  });

  describe('createBatches — batch properties', () => {
    it('assigns sequential numeric IDs starting at 1', () => {
      const reg = new ComponentRegistry();
      for (let i = 0; i < 15; i++) reg.add(makeEntry('Flow', `Flow${i}`));
      const batches = new BatchManager().createBatches(reg, 10);
      assert.strictEqual(batches[0].id, 1);
      assert.strictEqual(batches[1].id, 2);
    });

    it('componentCount matches actual chunk size', () => {
      const reg = new ComponentRegistry();
      for (let i = 0; i < 25; i++) reg.add(makeEntry('ApexClass', `C${i}`));
      const batches = new BatchManager().createBatches(reg, 10);
      assert.strictEqual(batches[0].componentCount, 10);
      assert.strictEqual(batches[1].componentCount, 10);
      assert.strictEqual(batches[2].componentCount, 5);
    });

    it('total components across all batches equals registry size', () => {
      const reg = new ComponentRegistry();
      for (let i = 0; i < 37; i++) reg.add(makeEntry('CustomField', `Account.F${i}`));
      const batches = new BatchManager().createBatches(reg, 15);
      const total = batches.reduce((sum, b) => sum + b.componentCount, 0);
      assert.strictEqual(total, 37);
    });

    it('componentSet is an array of {type, apiName} objects', () => {
      const reg = buildRegistry(makeEntry('Flow', 'MyFlow'));
      const batches = new BatchManager().createBatches(reg, 10);
      const item = (batches[0].componentSet as Array<{ type: string; apiName: string }>)[0];
      assert.strictEqual(item.type, 'Flow');
      assert.strictEqual(item.apiName, 'MyFlow');
    });
  });

  describe('createBatches — label format', () => {
    it('label includes batch number and total', () => {
      const reg = new ComponentRegistry();
      for (let i = 0; i < 15; i++) reg.add(makeEntry('ApexClass', `C${i}`));
      const batches = new BatchManager().createBatches(reg, 10);
      assert.ok(batches[0].label.includes('1/2'), `expected "1/2" in label: ${batches[0].label}`);
      assert.ok(batches[1].label.includes('2/2'), `expected "2/2" in label: ${batches[1].label}`);
    });

    it('label includes the metadata type', () => {
      const reg = buildRegistry(makeEntry('Flow', 'MyFlow'));
      const batches = new BatchManager().createBatches(reg, 10);
      assert.ok(batches[0].label.includes('Flow'), `expected "Flow" in label: ${batches[0].label}`);
    });

    it('label includes top type count', () => {
      const reg = new ComponentRegistry();
      for (let i = 0; i < 3; i++) reg.add(makeEntry('ApexClass', `C${i}`));
      const batches = new BatchManager().createBatches(reg, 10);
      assert.ok(batches[0].label.includes('×3'), `expected "×3" in label: ${batches[0].label}`);
    });
  });

  describe('createBatches — multi-type batches', () => {
    it('groups same-type items together in orderedEntries', () => {
      const reg = new ComponentRegistry();
      reg.add(makeEntry('ApexClass', 'A'));
      reg.add(makeEntry('Flow', 'F'));
      reg.add(makeEntry('ApexClass', 'B'));
      // batchSize=10: should fit in 1 batch with 3 items
      const batches = new BatchManager().createBatches(reg, 10);
      assert.strictEqual(batches[0].componentCount, 3);
    });

    it('label shows up to 3 top types', () => {
      const reg = new ComponentRegistry();
      for (let i = 0; i < 3; i++) reg.add(makeEntry('ApexClass', `C${i}`));
      for (let i = 0; i < 2; i++) reg.add(makeEntry('Flow', `F${i}`));
      for (let i = 0; i < 1; i++) reg.add(makeEntry('CustomField', `Account.X${i}`));
      const batches = new BatchManager().createBatches(reg, 20);
      const label = batches[0].label;
      assert.ok(label.includes('ApexClass'), label);
      assert.ok(label.includes('Flow'), label);
    });
  });

  describe('createBatches — exact batch boundary', () => {
    it('creates exactly N/batchSize batches when evenly divisible', () => {
      const reg = new ComponentRegistry();
      for (let i = 0; i < 20; i++) reg.add(makeEntry('Flow', `F${i}`));
      const batches = new BatchManager().createBatches(reg, 5);
      assert.strictEqual(batches.length, 4);
    });
  });
});
