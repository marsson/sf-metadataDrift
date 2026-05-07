import * as cliProgress from 'cli-progress';
import chalk from 'chalk';
import pLimit from 'p-limit';
import { compareComponent } from './ComponentComparator';
import { DriftLogger } from '../../utils/Logger';
import type { ComponentRegistry } from '../discovery/ComponentRegistry';
import type { OrgSnapshot } from '../../types/ComponentTypes';
import type { DriftResult } from '../../types/DriftReport';
import type { ComparisonConfig } from '../../types/Config';

export class ComparisonEngine {
  private logger: DriftLogger;

  constructor(
    private readonly config: ComparisonConfig,
    private readonly noProgress = false
  ) {
    this.logger = DriftLogger.create(false);
  }

  async compare(
    registry: ComponentRegistry,
    snapshot: OrgSnapshot
  ): Promise<DriftResult[]> {
    const entries = registry.toArray();
    const total = entries.length;

    let bar: cliProgress.SingleBar | null = null;
    if (!this.noProgress) {
      bar = new cliProgress.SingleBar(
        {
          format:
            `  Comparing  ${chalk.cyan('{bar}')} | ` +
            `${chalk.bold('{value}/{total}')} components  ` +
            `{percentage}%  {eta_formatted}`,
          barCompleteChar: '█',
          barIncompleteChar: '░',
          hideCursor: true,
          clearOnComplete: false,
          etaBuffer: 30,
        },
        cliProgress.Presets.shades_classic
      );
      bar.start(total, 0);
    }

    const limit = pLimit(this.config.workers);
    let completed = 0;
    const results: DriftResult[] = [];

    const tasks = entries.map(entry =>
      limit(async () => {
        const orgFilePaths = snapshot.fileIndex.get(entry.manifestKey) ?? [];
        try {
          const result = await compareComponent(entry, orgFilePaths, this.config);
          results.push(result);
        } catch (err) {
          // Comparison failure — record as a special result
          results.push({
            manifestKey: entry.manifestKey,
            metadataType: entry.metadataType,
            apiName: entry.apiName,
            status: 'CHANGED',
            repoFilePaths: entry.filePaths,
            orgFilePaths,
            linesAdded: 0,
            linesRemoved: 0,
            hunks: [],
          });
          this.logger.verbose(
            `Compare error for ${entry.manifestKey}: ${err instanceof Error ? err.message : String(err)}`
          );
        } finally {
          completed++;
          bar?.update(completed);
        }
      })
    );

    await Promise.all(tasks);

    bar?.stop();
    if (bar) process.stdout.write('\n');

    return results.filter(r => r.status !== 'UNCHANGED');
  }
}
