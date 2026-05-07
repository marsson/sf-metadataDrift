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

  async retrieve(batch: RetrieveBatch): Promise<BatchRetrieveResult> {
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
        this.logger.warn(`Batch ${batch.id} retrieve error: ${errMsg}`);
        throw err;
      }
    }, { maxRetries: 2, initialDelayMs: 3_000 });
  }
}
