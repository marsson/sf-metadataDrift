import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import stripAnsi from 'strip-ansi';
import { TableReporter } from '../../../src/core/reporting/TableReporter';
import type { DriftReport, DriftResult } from '../../../src/types/DriftReport';
import type { ReporterConfig } from '../../../src/types/Config';

const defaultReporterConfig: ReporterConfig = {
  outputFile: null,
  verbose: false,
  htmlOptions: {
    title: 'Test Report',
    theme: 'light',
    includeUnchanged: false,
    syntaxHighlight: false,
  },
};

let tmpDir: string;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tablereporter-test-'));
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeResult(overrides: Partial<DriftResult>): DriftResult {
  return {
    manifestKey: 'ApexClass:MyClass',
    metadataType: 'ApexClass',
    apiName: 'MyClass',
    status: 'CHANGED',
    repoFilePaths: [],
    orgFilePaths: [],
    linesAdded: 5,
    linesRemoved: 3,
    hunks: [],
    ...overrides,
  };
}

function makeReport(components: DriftResult[]): DriftReport {
  const changed = components.filter(c => c.status === 'CHANGED').length;
  const deleted = components.filter(c => c.status === 'DELETED').length;
  const orgOnly = components.filter(c => c.status === 'ORG_ONLY').length;
  return {
    meta: {
      generatedAt: new Date().toISOString(),
      orgAlias: 'sandbox-dev',
      orgId: '00D000000000001',
      apiVersion: '59.0',
      projectDir: '/project',
      scanDurationMs: 5000,
      toolVersion: '0.1.0',
    },
    summary: {
      totalScanned: components.length + 2,
      totalDrifted: changed + deleted + orgOnly,
      changed,
      deleted,
      orgOnly,
      unchanged: 2,
    },
    components,
  };
}

async function captureStdout(fn: () => Promise<void>): Promise<string> {
  const chunks: string[] = [];
  const original = process.stdout.write.bind(process.stdout);
  (process.stdout as any).write = (chunk: string | Uint8Array) => {
    if (typeof chunk === 'string') chunks.push(chunk);
    return true;
  };
  try {
    await fn();
  } finally {
    (process.stdout as any).write = original;
  }
  return chunks.join('');
}

describe('TableReporter', () => {

  describe('row output', () => {
    it('includes the metadata type in output', async () => {
      const report = makeReport([makeResult({ metadataType: 'ApexClass', apiName: 'MyClass' })]);
      const output = stripAnsi(await captureStdout(() =>
        new TableReporter().generate(report, defaultReporterConfig)
      ));
      assert.ok(output.includes('ApexClass'), 'should include metadata type');
    });

    it('includes the api name in output', async () => {
      const report = makeReport([makeResult({ apiName: 'SpecialClass' })]);
      const output = stripAnsi(await captureStdout(() =>
        new TableReporter().generate(report, defaultReporterConfig)
      ));
      assert.ok(output.includes('SpecialClass'), 'should include api name');
    });

    it('includes CHANGED status in output', async () => {
      const report = makeReport([makeResult({ status: 'CHANGED' })]);
      const output = stripAnsi(await captureStdout(() =>
        new TableReporter().generate(report, defaultReporterConfig)
      ));
      assert.ok(output.includes('CHANGED'));
    });

    it('includes DELETED status in output', async () => {
      const report = makeReport([makeResult({ status: 'DELETED', linesAdded: 0, linesRemoved: 0 })]);
      const output = stripAnsi(await captureStdout(() =>
        new TableReporter().generate(report, defaultReporterConfig)
      ));
      assert.ok(output.includes('DELETED'));
    });

    it('includes ORG_ONLY status in output', async () => {
      const report = makeReport([makeResult({ status: 'ORG_ONLY', linesAdded: 0, linesRemoved: 0 })]);
      const output = stripAnsi(await captureStdout(() =>
        new TableReporter().generate(report, defaultReporterConfig)
      ));
      assert.ok(output.includes('ORG_ONLY'));
    });

    it('shows no-drift message when components list is empty', async () => {
      const report = makeReport([]);
      const output = stripAnsi(await captureStdout(() =>
        new TableReporter().generate(report, defaultReporterConfig)
      ));
      assert.ok(output.includes('No drift') || output.includes('clean'), 'should show clean message');
    });
  });

  describe('sort order', () => {
    it('sorts DELETED before CHANGED before ORG_ONLY', async () => {
      const report = makeReport([
        makeResult({ manifestKey: 'Flow:F', metadataType: 'Flow', apiName: 'F', status: 'ORG_ONLY', linesAdded: 0, linesRemoved: 0 }),
        makeResult({ manifestKey: 'ApexClass:A', metadataType: 'ApexClass', apiName: 'A', status: 'CHANGED' }),
        makeResult({ manifestKey: 'CustomField:X', metadataType: 'CustomField', apiName: 'X', status: 'DELETED', linesAdded: 0, linesRemoved: 0 }),
      ]);
      const output = stripAnsi(await captureStdout(() =>
        new TableReporter().generate(report, defaultReporterConfig)
      ));

      const deletedPos = output.indexOf('DELETED');
      const changedPos = output.indexOf('CHANGED');
      const orgOnlyPos = output.indexOf('ORG_ONLY');

      assert.ok(deletedPos < changedPos, 'DELETED should appear before CHANGED');
      assert.ok(changedPos < orgOnlyPos, 'CHANGED should appear before ORG_ONLY');
    });
  });

  describe('summary line', () => {
    it('includes org alias in summary', async () => {
      const report = makeReport([makeResult({})]);
      const output = stripAnsi(await captureStdout(() =>
        new TableReporter().generate(report, defaultReporterConfig)
      ));
      assert.ok(output.includes('sandbox-dev'), 'should include org alias');
    });

    it('includes total scanned count', async () => {
      const report = makeReport([makeResult({})]);
      const output = stripAnsi(await captureStdout(() =>
        new TableReporter().generate(report, defaultReporterConfig)
      ));
      assert.ok(output.includes('3'), 'should include total scanned count (1 component + 2 unchanged = 3)');
    });
  });

  describe('file output', () => {
    it('writes plain text (no ANSI) to output file', async () => {
      const outPath = path.join(tmpDir, 'report.txt');
      const report = makeReport([makeResult({ apiName: 'FileClass' })]);
      await captureStdout(() =>
        new TableReporter().generate(report, { ...defaultReporterConfig, outputFile: outPath })
      );
      assert.ok(fs.existsSync(outPath), 'output file should exist');
      const content = fs.readFileSync(outPath, 'utf8');
      // File content should not contain ANSI escape sequences
      assert.strictEqual(content, stripAnsi(content), 'file should not contain ANSI codes');
      assert.ok(content.includes('FileClass'), 'file should contain api name');
    });
  });

  describe('line counts', () => {
    it('shows + and - line counts for CHANGED items', async () => {
      const report = makeReport([makeResult({ status: 'CHANGED', linesAdded: 7, linesRemoved: 4 })]);
      const output = stripAnsi(await captureStdout(() =>
        new TableReporter().generate(report, defaultReporterConfig)
      ));
      assert.ok(output.includes('+7'), 'should show added count');
      assert.ok(output.includes('-4'), 'should show removed count');
    });

    it('shows dash for DELETED items (no line counts)', async () => {
      const report = makeReport([makeResult({ status: 'DELETED', linesAdded: 0, linesRemoved: 0 })]);
      const output = stripAnsi(await captureStdout(() =>
        new TableReporter().generate(report, defaultReporterConfig)
      ));
      assert.ok(output.includes('—'), 'should show dash for deleted');
    });
  });
});
