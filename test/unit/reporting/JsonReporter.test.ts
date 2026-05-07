import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { JsonReporter } from '../../../src/core/reporting/JsonReporter';
import type { DriftReport } from '../../../src/types/DriftReport';
import type { ReporterConfig } from '../../../src/types/Config';

let tmpDir: string;

const defaultReporterConfig = {
  outputFile: null as string | null,
  verbose: false,
  htmlOptions: {
    title: 'Test Report',
    theme: 'light' as const,
    includeUnchanged: false,
    syntaxHighlight: false,
  },
};

function makeReport(overrides: Partial<DriftReport> = {}): DriftReport {
  return {
    meta: {
      generatedAt: new Date().toISOString(),
      orgAlias: 'my-sandbox',
      orgId: '00D000000000001',
      apiVersion: '59.0',
      projectDir: '/project',
      scanDurationMs: 1234,
      toolVersion: '0.1.0',
    },
    summary: {
      totalScanned: 5,
      totalDrifted: 2,
      changed: 1,
      deleted: 1,
      orgOnly: 0,
      unchanged: 3,
    },
    components: [],
    ...overrides,
  };
}

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsonreporter-test-'));
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('JsonReporter', () => {

  describe('stdout output', () => {
    it('writes valid JSON to stdout when no outputFile', async () => {
      const reporter = new JsonReporter();
      const chunks: string[] = [];
      const original = process.stdout.write.bind(process.stdout);
      (process.stdout as any).write = (chunk: string) => { chunks.push(chunk); return true; };

      try {
        await reporter.generate(makeReport(), { ...defaultReporterConfig });
      } finally {
        (process.stdout as any).write = original;
      }

      const output = chunks.join('');
      const parsed = JSON.parse(output);
      assert.strictEqual(parsed.meta.orgAlias, 'my-sandbox');
    });

    it('produces compact JSON to stdout when not verbose', async () => {
      const reporter = new JsonReporter();
      const chunks: string[] = [];
      const original = process.stdout.write.bind(process.stdout);
      (process.stdout as any).write = (chunk: string) => { chunks.push(chunk); return true; };

      try {
        await reporter.generate(makeReport(), { ...defaultReporterConfig });
      } finally {
        (process.stdout as any).write = original;
      }

      const output = chunks.join('').trim();
      // Compact JSON has no newlines inside the JSON itself
      assert.ok(!output.slice(1, -1).includes('\n'), 'compact JSON should not have internal newlines');
    });

    it('produces pretty-printed JSON to stdout when verbose', async () => {
      const reporter = new JsonReporter();
      const chunks: string[] = [];
      const original = process.stdout.write.bind(process.stdout);
      (process.stdout as any).write = (chunk: string) => { chunks.push(chunk); return true; };

      try {
        await reporter.generate(makeReport(), { ...defaultReporterConfig, verbose: true });
      } finally {
        (process.stdout as any).write = original;
      }

      const output = chunks.join('');
      assert.ok(output.includes('\n'), 'verbose JSON should be pretty-printed with newlines');
    });
  });

  describe('file output', () => {
    it('writes a JSON file when outputFile is set', async () => {
      const outPath = path.join(tmpDir, 'report.json');
      const reporter = new JsonReporter();
      const chunks: string[] = [];
      const original = process.stdout.write.bind(process.stdout);
      (process.stdout as any).write = (chunk: string) => { chunks.push(chunk); return true; };

      try {
        await reporter.generate(makeReport(), { ...defaultReporterConfig, outputFile: outPath });
      } finally {
        (process.stdout as any).write = original;
      }

      assert.ok(fs.existsSync(outPath), 'output file should exist');
      const content = fs.readFileSync(outPath, 'utf8');
      const parsed = JSON.parse(content);
      assert.strictEqual(parsed.meta.orgAlias, 'my-sandbox');
    });

    it('writes pretty-printed JSON to file', async () => {
      const outPath = path.join(tmpDir, 'report-pretty.json');
      const reporter = new JsonReporter();
      const chunks: string[] = [];
      const original = process.stdout.write.bind(process.stdout);
      (process.stdout as any).write = (chunk: string) => { chunks.push(chunk); return true; };

      try {
        await reporter.generate(makeReport(), { ...defaultReporterConfig, outputFile: outPath });
      } finally {
        (process.stdout as any).write = original;
      }

      const content = fs.readFileSync(outPath, 'utf8');
      assert.ok(content.includes('\n'), 'file output should be pretty-printed');
    });

    it('preserves all summary fields in output', async () => {
      const report = makeReport();
      const reporter = new JsonReporter();
      const chunks: string[] = [];
      const original = process.stdout.write.bind(process.stdout);
      (process.stdout as any).write = (chunk: string) => { chunks.push(chunk); return true; };

      try {
        await reporter.generate(report, { ...defaultReporterConfig, verbose: true });
      } finally {
        (process.stdout as any).write = original;
      }

      const parsed = JSON.parse(chunks.join(''));
      assert.strictEqual(parsed.summary.totalScanned, 5);
      assert.strictEqual(parsed.summary.changed, 1);
      assert.strictEqual(parsed.summary.deleted, 1);
    });

    it('preserves components array in output', async () => {
      const report = makeReport({
        components: [{
          manifestKey: 'ApexClass:MyClass',
          metadataType: 'ApexClass',
          apiName: 'MyClass',
          status: 'CHANGED',
          repoFilePaths: ['/repo/MyClass.cls'],
          orgFilePaths: ['/org/MyClass.cls'],
          linesAdded: 2,
          linesRemoved: 1,
          hunks: [],
        }],
      });

      const reporter = new JsonReporter();
      const chunks: string[] = [];
      const original = process.stdout.write.bind(process.stdout);
      (process.stdout as any).write = (chunk: string) => { chunks.push(chunk); return true; };

      try {
        await reporter.generate(report, { ...defaultReporterConfig, verbose: true });
      } finally {
        (process.stdout as any).write = original;
      }

      const parsed = JSON.parse(chunks.join(''));
      assert.strictEqual(parsed.components.length, 1);
      assert.strictEqual(parsed.components[0].apiName, 'MyClass');
    });
  });
});
