import type { RetrieveBatch, FailedComponent } from '../../types/ComponentTypes';
import { withRetry } from './RetryHandler';
import { DriftLogger } from '../../utils/Logger';

interface BatchRetrieveResult {
  success: boolean;
  retrievedPaths: string[];
  failures: FailedComponent[];
}

export class MdapiRetriever {
  private logger: DriftLogger;

  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly connection: any,
    private readonly outputDir: string,
    private readonly timeoutMs: number,
    private readonly apiVersion: string | null,
    isVerbose = false
  ) {
    this.logger = DriftLogger.create(isVerbose);
  }

  /**
   * Retrieve a batch, isolating any component whose conversion fails.
   *
   * A single component can abort the whole MDAPI→source conversion — e.g. a large Flow with
   * >1000 XML entity references trips fast-xml-parser's `maxTotalExpansions` guard
   * ("Entity expansion limit exceeded: N > 1000"). Rather than let that fail the batch (and,
   * upstream, the entire run), bisect the batch and retry each half so only the offending
   * component(s) are skipped and recorded as failures; everything else is still retrieved.
   */
  async retrieve(batch: RetrieveBatch): Promise<BatchRetrieveResult> {
    try {
      return await this.retrieveOnce(batch);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const entries = (batch.componentSet ?? []) as Array<{ type: string; apiName: string }>;

      // Down to a single component that still fails — skip it, record it, keep going.
      if (entries.length <= 1) {
        const e = entries[0];
        const failed: FailedComponent = e
          ? { manifestKey: `${e.type}:${e.apiName}`, metadataType: e.type, apiName: e.apiName, error: errMsg }
          : { manifestKey: 'Unknown', metadataType: 'Unknown', apiName: 'Unknown', error: errMsg };
        this.logger.warn(`Skipping component that failed to retrieve/convert: ${failed.manifestKey} (${errMsg})`);
        return { success: false, retrievedPaths: [], failures: [failed] };
      }

      // Bisect to isolate the offender(s) instead of losing the whole batch.
      this.logger.verbose(
        `Batch ${batch.id} failed (${errMsg}); bisecting ${entries.length} components to isolate the offender`
      );
      const mid = Math.floor(entries.length / 2);
      const halves = [entries.slice(0, mid), entries.slice(mid)];
      const merged: BatchRetrieveResult = { success: true, retrievedPaths: [], failures: [] };
      for (let h = 0; h < halves.length; h++) {
        const sub: RetrieveBatch = {
          ...batch,
          componentSet: halves[h],
          componentCount: halves[h].length,
          label: `${batch.label} [${h + 1}/2]`,
        };
        const r = await this.retrieve(sub);
        merged.retrievedPaths.push(...r.retrievedPaths);
        merged.failures.push(...r.failures);
        merged.success = merged.success && r.success;
      }
      return merged;
    }
  }

  private async retrieveOnce(batch: RetrieveBatch): Promise<BatchRetrieveResult> {
    return withRetry(async () => {
      try {
        const { ComponentSet } = await import('@salesforce/source-deploy-retrieve');
        const cs = new ComponentSet();

        const entries = batch.componentSet as Array<{ type: string; apiName: string }>;
        for (const entry of entries) {
          try {
            cs.add({ fullName: entry.apiName, type: entry.type });
          } catch {
            this.logger.verbose(`Skipping unsupported type: ${entry.type}:${entry.apiName}`);
          }
        }

        if (cs.size === 0) {
          return { success: true, retrievedPaths: [], failures: [] };
        }

        // SDR v11 retrieve — handles MDAPI → source format conversion automatically
        const op = await cs.retrieve({
          usernameOrConnection: this.connection,
          output: this.outputDir,
          merge: true,
          ...(this.apiVersion ? { apiVersion: this.apiVersion } : {}),
        });

        // SDR v11: pollStatus(frequency?, timeout?) — positional args
        const pollFrequencyMs = 2_000;
        const result = await op.pollStatus(pollFrequencyMs, this.timeoutMs);

        const failures: FailedComponent[] = [];
        if (result.response.messages) {
          const messages = Array.isArray(result.response.messages)
            ? result.response.messages
            : [result.response.messages];

          for (const msg of messages) {
            const problem = (msg as Record<string, unknown>).problem as string | undefined;
            const fileName = (msg as Record<string, unknown>).fileName as string | undefined;
            if (problem) {
              failures.push({
                manifestKey: `Unknown:${fileName ?? 'Unknown'}`,
                metadataType: 'Unknown',
                apiName: fileName ?? 'Unknown',
                error: problem,
              });
            }
          }
        }

        const retrievedPaths: string[] = [];
        if (result.response.fileProperties) {
          const props = Array.isArray(result.response.fileProperties)
            ? result.response.fileProperties
            : [result.response.fileProperties];
          for (const fp of props) {
            const fileName = (fp as Record<string, unknown>).fileName as string | undefined;
            if (fileName) retrievedPaths.push(fileName);
          }
        }

        this.logger.verbose(
          `Batch ${batch.id}: retrieved ${retrievedPaths.length} files, ${failures.length} failures`
        );

        return {
          success: result.response.status !== 'Failed',
          retrievedPaths,
          failures,
        };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.verbose(`Batch ${batch.id} retrieve attempt failed: ${errMsg}`);
        throw err;
      }
    }, { maxRetries: 2, initialDelayMs: 3_000 });
  }
}
