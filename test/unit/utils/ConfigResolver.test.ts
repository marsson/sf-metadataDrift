import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveConfig } from '../../../src/utils/ConfigResolver';

let tmpDir: string;

function makeProjDir(rc?: object): string {
  const dir = fs.mkdtempSync(path.join(tmpDir, 'proj-'));
  if (rc) {
    fs.writeFileSync(path.join(dir, '.driftrc.json'), JSON.stringify(rc), 'utf8');
  }
  return dir;
}

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'configresolver-test-'));
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// Clean env vars before each test
beforeEach(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('SF_DRIFT_')) delete process.env[key];
  }
});

describe('ConfigResolver', () => {

  describe('defaults', () => {
    it('uses "table" as default format', () => {
      const config = resolveConfig({}, makeProjDir());
      assert.strictEqual(config.format, 'table');
    });

    it('uses 500 as default batchSize', () => {
      const config = resolveConfig({}, makeProjDir());
      assert.strictEqual(config.batchSize, 500);
    });

    it('uses 60000 as default retrieveTimeout', () => {
      const config = resolveConfig({}, makeProjDir());
      assert.strictEqual(config.retrieveTimeout, 60_000);
    });

    it('defaults verbose to false', () => {
      const config = resolveConfig({}, makeProjDir());
      assert.strictEqual(config.verbose, false);
    });

    it('defaults reportOrgOnly to false', () => {
      const config = resolveConfig({}, makeProjDir());
      assert.strictEqual(config.reportOrgOnly, false);
    });

    it('defaults keepTemp to false', () => {
      const config = resolveConfig({}, makeProjDir());
      assert.strictEqual(config.keepTemp, false);
    });

    it('defaults dryRun to false', () => {
      const config = resolveConfig({}, makeProjDir());
      assert.strictEqual(config.dryRun, false);
    });

    it('defaults xmlNormalization to true', () => {
      const config = resolveConfig({}, makeProjDir());
      assert.strictEqual(config.comparison.xmlNormalization, true);
    });

    it('defaults exclusions.useDefaults to true', () => {
      const config = resolveConfig({}, makeProjDir());
      assert.strictEqual(config.exclusions.useDefaults, true);
    });

    it('defaults outputFile to null', () => {
      const config = resolveConfig({}, makeProjDir());
      assert.strictEqual(config.outputFile, null);
    });

    it('defaults apiVersion to null', () => {
      const config = resolveConfig({}, makeProjDir());
      assert.strictEqual(config.apiVersion, null);
    });
  });

  describe('flag precedence', () => {
    it('flag overrides default format', () => {
      const config = resolveConfig({ format: 'json' }, makeProjDir());
      assert.strictEqual(config.format, 'json');
    });

    it('flag overrides default batchSize', () => {
      const config = resolveConfig({ 'batch-size': 200 }, makeProjDir());
      assert.strictEqual(config.batchSize, 200);
    });

    it('flag verbose=true sets verbose', () => {
      const config = resolveConfig({ verbose: true }, makeProjDir());
      assert.strictEqual(config.verbose, true);
    });

    it('flag output sets outputFile', () => {
      const config = resolveConfig({ output: '/tmp/report.json' }, makeProjDir());
      assert.strictEqual(config.outputFile, '/tmp/report.json');
    });

    it('target-org flag sets targetOrg', () => {
      const config = resolveConfig({ 'target-org': 'my-sandbox' }, makeProjDir());
      assert.strictEqual(config.targetOrg, 'my-sandbox');
    });

    it('api-version flag sets apiVersion', () => {
      const config = resolveConfig({ 'api-version': '60.0' }, makeProjDir());
      assert.strictEqual(config.apiVersion, '60.0');
    });
  });

  describe('rc file precedence', () => {
    it('rc file defaultFormat is used when no flag', () => {
      const dir = makeProjDir({ defaultFormat: 'html' });
      const config = resolveConfig({}, dir);
      assert.strictEqual(config.format, 'html');
    });

    it('rc file batchSize is used when no flag', () => {
      const dir = makeProjDir({ batchSize: 250 });
      const config = resolveConfig({}, dir);
      assert.strictEqual(config.batchSize, 250);
    });

    it('rc file verbose is used when no flag', () => {
      const dir = makeProjDir({ verbose: true });
      const config = resolveConfig({}, dir);
      assert.strictEqual(config.verbose, true);
    });

    it('flag takes precedence over rc file', () => {
      const dir = makeProjDir({ defaultFormat: 'html' });
      const config = resolveConfig({ format: 'json' }, dir);
      assert.strictEqual(config.format, 'json');
    });
  });

  describe('env var precedence', () => {
    it('SF_DRIFT_FORMAT env var is used when no flag', () => {
      process.env.SF_DRIFT_FORMAT = 'json';
      const config = resolveConfig({}, makeProjDir());
      assert.strictEqual(config.format, 'json');
    });

    it('SF_DRIFT_VERBOSE=true sets verbose', () => {
      process.env.SF_DRIFT_VERBOSE = 'true';
      const config = resolveConfig({}, makeProjDir());
      assert.strictEqual(config.verbose, true);
    });

    it('SF_DRIFT_BATCH_SIZE sets batchSize', () => {
      process.env.SF_DRIFT_BATCH_SIZE = '300';
      const config = resolveConfig({}, makeProjDir());
      assert.strictEqual(config.batchSize, 300);
    });

    it('flag takes precedence over env var', () => {
      process.env.SF_DRIFT_FORMAT = 'html';
      const config = resolveConfig({ format: 'json' }, makeProjDir());
      assert.strictEqual(config.format, 'json');
    });
  });

  describe('exclusions', () => {
    it('no-defaults-exclusion=true sets useDefaults=false', () => {
      const config = resolveConfig({ 'no-defaults-exclusion': true }, makeProjDir());
      assert.strictEqual(config.exclusions.useDefaults, false);
    });

    it('exclude-types flag adds to additionalTypes', () => {
      const config = resolveConfig({ 'exclude-types': 'Flow,ApexClass' }, makeProjDir());
      assert.ok(config.exclusions.additionalTypes.includes('Flow'));
      assert.ok(config.exclusions.additionalTypes.includes('ApexClass'));
    });

    it('rc additionalTypes are included', () => {
      const dir = makeProjDir({ exclusions: { additionalTypes: ['CustomMetadata'] } });
      const config = resolveConfig({}, dir);
      assert.ok(config.exclusions.additionalTypes.includes('CustomMetadata'));
    });
  });

  describe('comparison config', () => {
    it('rc comparison settings are applied', () => {
      const dir = makeProjDir({ comparison: { xmlNormalization: false, contextLines: 10 } });
      const config = resolveConfig({}, dir);
      assert.strictEqual(config.comparison.xmlNormalization, false);
      assert.strictEqual(config.comparison.contextLines, 10);
    });
  });

  describe('missing or malformed rc file', () => {
    it('works when no .driftrc.json exists', () => {
      const dir = makeProjDir(); // no rc file
      assert.doesNotThrow(() => resolveConfig({}, dir));
    });

    it('ignores a malformed .driftrc.json gracefully', () => {
      const dir = fs.mkdtempSync(path.join(tmpDir, 'badrc-'));
      fs.writeFileSync(path.join(dir, '.driftrc.json'), '{ invalid json }', 'utf8');
      assert.doesNotThrow(() => resolveConfig({}, dir));
    });
  });
});
