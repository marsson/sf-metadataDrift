import * as fs from 'fs';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';
import { formatDuration } from '../../utils/FileUtils';
import type { Reporter } from './Reporter';
import type { DriftReport, DriftResult } from '../../types/DriftReport';
import type { ReporterConfig } from '../../types/Config';

const COL_TYPE = 22;
const COL_NAME = 38;
const COL_STATUS = 10;
const COL_ADDED = 8;
const COL_REMOVED = 9;
const TOTAL_WIDTH = COL_TYPE + COL_NAME + COL_STATUS + COL_ADDED + COL_REMOVED + 6;

function pad(str: string, len: number, visible?: string): string {
  const plain = visible ?? stripAnsi(str);
  const diff = len - plain.length;
  return diff > 0 ? str + ' '.repeat(diff) : str;
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + '…';
}

function statusCell(status: string): string {
  switch (status) {
    case 'CHANGED':  return chalk.yellow('CHANGED');
    case 'DELETED':  return chalk.red('DELETED');
    case 'ORG_ONLY': return chalk.cyan('ORG_ONLY');
    default:         return status;
  }
}

function renderRow(r: DriftResult): string {
  const type   = truncate(r.metadataType, COL_TYPE);
  const name   = truncate(r.apiName, COL_NAME);
  const status = statusCell(r.status);
  const added  = r.status === 'CHANGED' ? chalk.green(`+${r.linesAdded}`) : chalk.dim('—');
  const removed = r.status === 'CHANGED' ? chalk.red(`-${r.linesRemoved}`) : chalk.dim('—');

  return (
    ' ' +
    pad(type, COL_TYPE) + ' ' +
    pad(name, COL_NAME) + ' ' +
    pad(status, COL_STATUS, stripAnsi(status).padEnd(COL_STATUS)) + ' ' +
    pad(added, COL_ADDED, stripAnsi(added).padStart(COL_ADDED)) + '  ' +
    pad(removed, COL_REMOVED, stripAnsi(removed).padStart(COL_REMOVED))
  );
}

export class TableReporter implements Reporter {
  async generate(report: DriftReport, config: ReporterConfig): Promise<void> {
    const lines: string[] = [];

    const header =
      ' ' +
      chalk.bold(pad('Metadata Type', COL_TYPE)) + ' ' +
      chalk.bold(pad('API Name', COL_NAME)) + ' ' +
      chalk.bold(pad('Status', COL_STATUS)) + ' ' +
      chalk.bold(pad('Δ Added', COL_ADDED)) + '  ' +
      chalk.bold(pad('Δ Removed', COL_REMOVED));

    const sep = ' ' + chalk.dim('─'.repeat(TOTAL_WIDTH - 1));

    lines.push(header);
    lines.push(sep);

    // Sort: DELETED first, then CHANGED, then ORG_ONLY; within group alpha
    const sorted = [...report.components].sort((a, b) => {
      const order: Record<string, number> = { DELETED: 0, CHANGED: 1, ORG_ONLY: 2 };
      const oa = order[a.status] ?? 99;
      const ob = order[b.status] ?? 99;
      if (oa !== ob) return oa - ob;
      const typeCompare = a.metadataType.localeCompare(b.metadataType);
      if (typeCompare !== 0) return typeCompare;
      return a.apiName.localeCompare(b.apiName);
    });

    for (const r of sorted) {
      lines.push(renderRow(r));
    }

    if (sorted.length === 0) {
      lines.push(chalk.green('  ✔ No drift detected — org matches repository perfectly.'));
    }

    lines.push('');

    const { changed, deleted, orgOnly, totalScanned, totalDrifted } = report.summary;
    const duration = formatDuration(report.meta.scanDurationMs);

    const summaryParts = [];
    if (changed > 0) summaryParts.push(chalk.yellow(`${changed} changed`));
    if (deleted > 0) summaryParts.push(chalk.red(`${deleted} deleted`));
    if (orgOnly > 0) summaryParts.push(chalk.cyan(`${orgOnly} org-only`));

    const driftStr = totalDrifted > 0
      ? chalk.bold(`${totalDrifted} drifted`) + ` (${summaryParts.join(' · ')})`
      : chalk.green.bold('clean — no drift');

    lines.push(
      chalk.dim('─'.repeat(TOTAL_WIDTH)) +
      `\n ${driftStr} ${chalk.dim('of')} ${chalk.bold(String(totalScanned))} ` +
      chalk.dim(`scanned — ${duration}`) +
      `\n ${chalk.dim('Org:')} ${report.meta.orgAlias} ${chalk.dim(report.meta.orgId)}` +
      `   ${chalk.dim('API:')} ${report.meta.apiVersion}`
    );

    const output = lines.join('\n');

    if (config.outputFile) {
      await fs.promises.writeFile(config.outputFile, stripAnsi(output), 'utf8');
      process.stdout.write(output + '\n');
      process.stdout.write(chalk.dim(`\n  → Saved to ${config.outputFile}\n`));
    } else {
      process.stdout.write(output + '\n');
    }
  }
}
