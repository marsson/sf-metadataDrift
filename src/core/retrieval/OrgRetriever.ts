import * as fs from 'fs';
import * as path from 'path';
import * as cliProgress from 'cli-progress';
import chalk from 'chalk';
import { MdapiRetriever } from './MdapiRetriever';
import { BatchManager } from './BatchManager';
import { walkDir } from '../../utils/FileUtils';
import { resolveFromPath } from '../discovery/MetadataTypeResolver';
import { DriftLogger } from '../../utils/Logger';
import type { ComponentRegistry } from '../discovery/ComponentRegistry';
import type { OrgSnapshot, FailedComponent } from '../../types/ComponentTypes';
import type { RetrievalConfig } from '../../types/Config';

export class OrgRetriever {
  private logger: DriftLogger;

  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly connection: any,
    private readonly config: RetrievalConfig
  ) {
    this.logger = DriftLogger.create(config.verbose);
  }

  async retrieve(registry: ComponentRegistry): Promise<OrgSnapshot> {
    // SDR's merge:true requires a valid SFDX project in the output dir
    this.ensureSfdxProject(this.config.tempDir, this.config.apiVersion ?? '59.0');

    const batchMgr = new BatchManager();
    const batches = batchMgr.createBatches(registry, this.config.batchSize);

    this.logger.info(
      `Batching ${chalk.bold(String(registry.size))} components → ` +
      `${chalk.bold(String(batches.length))} ${batches.length === 1 ? 'batch' : 'batches'} ` +
      `(batch size: ${this.config.batchSize})`
    );

    const allFailures: FailedComponent[] = [];
    let bar: cliProgress.SingleBar | null = null;

    if (!this.config.noProgress) {
      bar = new cliProgress.SingleBar(
        {
          format:
            `  Retrieving ${chalk.cyan('{bar}')} | ` +
            `${chalk.bold('{value}/{total}')} batches  ` +
            `{status}`,
          barCompleteChar: '█',
          barIncompleteChar: '░',
          hideCursor: true,
          clearOnComplete: false,
          stopOnComplete: false,
        },
        cliProgress.Presets.shades_classic
      );
      bar.start(batches.length, 0, { status: '' });
    }

    const retriever = new MdapiRetriever(
      this.connection,
      this.config.tempDir,
      this.config.retrieveTimeout,
      this.config.apiVersion,
      this.config.verbose
    );

    // Sequential or parallel batch execution
    if (this.config.parallelBatches <= 1) {
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        bar?.update(i, { status: chalk.dim(batch.label) });

        const result = await retriever.retrieve(batch);
        allFailures.push(...result.failures);

        bar?.update(i + 1, { status: chalk.dim(batch.label) });
      }
    } else {
      // Parallel with concurrency limit
      const pLimit = (await import('p-limit')).default;
      const limit = pLimit(this.config.parallelBatches);
      let completed = 0;

      await Promise.all(
        batches.map(batch =>
          limit(async () => {
            const result = await retriever.retrieve(batch);
            allFailures.push(...result.failures);
            completed++;
            bar?.update(completed, { status: chalk.dim(batch.label) });
          })
        )
      );
    }

    bar?.stop();
    if (bar) process.stdout.write('\n');

    // Build fileIndex from the downloaded source tree
    this.logger.info('Indexing retrieved components...');
    const fileIndex = await this.buildFileIndex(this.config.tempDir);

    return {
      tempDir: this.config.tempDir,
      fileIndex,
      retrievedAt: new Date(),
      batchCount: batches.length,
      failedComponents: allFailures,
    };
  }

  private ensureSfdxProject(dir: string, apiVersion: string): void {
    const sfdxPath = path.join(dir, 'sfdx-project.json');
    if (!fs.existsSync(sfdxPath)) {
      fs.writeFileSync(sfdxPath, JSON.stringify({
        packageDirectories: [{ path: '.', default: true }],
        sourceApiVersion: apiVersion,
      }, null, 2), 'utf8');
    }
  }

  private async buildFileIndex(tempDir: string): Promise<Map<string, string[]>> {
    const index = new Map<string, string[]>();
    let indexed = 0;

    for await (const filePath of walkDir(tempDir)) {
      const resolved = resolveFromPath(filePath, tempDir);
      if (!resolved) continue;

      const key = `${resolved.metadataType}:${resolved.apiName}`;
      const existing = index.get(key) ?? [];
      existing.push(filePath);
      index.set(key, existing);
      indexed++;
    }

    this.logger.verbose(`Indexed ${indexed} files from org snapshot`);
    return index;
  }
}
