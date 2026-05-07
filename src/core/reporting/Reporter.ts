import type { DriftReport } from '../../types/DriftReport';
import type { ReporterConfig } from '../../types/Config';

export interface Reporter {
  generate(report: DriftReport, config: ReporterConfig): Promise<void>;
}

export function createReporter(format: 'table' | 'json' | 'html'): Reporter {
  switch (format) {
    case 'json': {
      const { JsonReporter } = require('./JsonReporter');
      return new JsonReporter();
    }
    case 'html': {
      const { HtmlReporter } = require('./HtmlReporter');
      return new HtmlReporter();
    }
    default: {
      const { TableReporter } = require('./TableReporter');
      return new TableReporter();
    }
  }
}
