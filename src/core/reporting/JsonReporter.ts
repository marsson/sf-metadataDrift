import * as fs from 'fs';
import type { Reporter } from './Reporter';
import type { DriftReport } from '../../types/DriftReport';
import type { ReporterConfig } from '../../types/Config';

export class JsonReporter implements Reporter {
  async generate(report: DriftReport, config: ReporterConfig): Promise<void> {
    // Pretty-print when writing to file or in verbose mode; compact for stdout pipe
    const indent = config.outputFile || config.verbose ? 2 : undefined;
    const json = JSON.stringify(report, null, indent);

    if (config.outputFile) {
      await fs.promises.writeFile(config.outputFile, json + '\n', 'utf8');
      process.stdout.write(`  → Saved JSON report to ${config.outputFile}\n`);
    } else {
      process.stdout.write(json + '\n');
    }
  }
}
