import type { ComponentEntry } from '../../types/ComponentTypes';

export class ComponentRegistry {
  private readonly entries: Map<string, ComponentEntry> = new Map();

  add(entry: ComponentEntry): void {
    const existing = this.entries.get(entry.manifestKey);
    if (existing) {
      for (const fp of entry.filePaths) {
        if (!existing.filePaths.includes(fp)) existing.filePaths.push(fp);
      }
      for (const rfp of entry.relativeFilePaths) {
        if (!existing.relativeFilePaths.includes(rfp)) existing.relativeFilePaths.push(rfp);
      }
    } else {
      this.entries.set(entry.manifestKey, { ...entry });
    }
  }

  get(key: string): ComponentEntry | undefined {
    return this.entries.get(key);
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  get size(): number {
    return this.entries.size;
  }

  toArray(): ComponentEntry[] {
    return Array.from(this.entries.values());
  }

  byType(): Map<string, ComponentEntry[]> {
    const map = new Map<string, ComponentEntry[]>();
    for (const entry of this.entries.values()) {
      const list = map.get(entry.metadataType) ?? [];
      list.push(entry);
      map.set(entry.metadataType, list);
    }
    return map;
  }

  filterByTypes(include: string[] | null, exclude: Set<string>): ComponentRegistry {
    const filtered = new ComponentRegistry();
    for (const entry of this.entries.values()) {
      if (exclude.has(entry.metadataType)) continue;
      if (include !== null && !include.includes(entry.metadataType)) continue;
      filtered.add(entry);
    }
    return filtered;
  }

  typeCount(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const entry of this.entries.values()) {
      counts.set(entry.metadataType, (counts.get(entry.metadataType) ?? 0) + 1);
    }
    return counts;
  }

  typeSummary(): string {
    const counts = this.typeCount();
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, 5).map(([t, c]) => `${t}×${c}`).join(', ');
  }
}
