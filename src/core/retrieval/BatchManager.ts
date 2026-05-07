import type { ComponentRegistry } from '../discovery/ComponentRegistry';
import type { RetrieveBatch } from '../../types/ComponentTypes';

export class BatchManager {
  createBatches(registry: ComponentRegistry, batchSize: number): RetrieveBatch[] {
    // Group entries by metadata type
    const byType = registry.byType();
    const batches: RetrieveBatch[] = [];

    // Build flat list of (type, apiName) pairs, grouped so same-type items cluster
    const orderedEntries: Array<{ type: string; apiName: string }> = [];
    for (const [type, entries] of byType) {
      for (const entry of entries) {
        orderedEntries.push({ type, apiName: entry.apiName });
      }
    }

    // Chunk into batches of batchSize
    for (let i = 0; i < orderedEntries.length; i += batchSize) {
      const chunk = orderedEntries.slice(i, i + batchSize);
      const batchId = batches.length + 1;

      // Build type summary for the label
      const typeCounts = new Map<string, number>();
      for (const e of chunk) {
        typeCounts.set(e.type, (typeCounts.get(e.type) ?? 0) + 1);
      }
      const topTypes = Array.from(typeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([t, c]) => `${t}×${c}`)
        .join(', ');

      const label = `batch ${batchId}/${Math.ceil(orderedEntries.length / batchSize)} (${topTypes})`;

      batches.push({
        id: batchId,
        componentSet: chunk,   // will be converted to ComponentSet in MdapiRetriever
        label,
        componentCount: chunk.length,
      });
    }

    return batches;
  }
}
