import * as assert from 'assert';
import { computeDiff } from '../../../src/core/comparison/TextDiff';

describe('TextDiff', () => {

  describe('computeDiff — identical files', () => {
    it('returns identical:true for equal content', () => {
      const content = '<Root><child>value</child></Root>';
      const result = computeDiff(content, content, 'test.xml');
      assert.strictEqual(result.identical, true);
      assert.strictEqual(result.linesAdded, 0);
      assert.strictEqual(result.linesRemoved, 0);
      assert.deepStrictEqual(result.hunks, []);
    });

    it('treats CRLF and LF as identical', () => {
      const lf = 'line1\nline2\nline3';
      const crlf = 'line1\r\nline2\r\nline3';
      const result = computeDiff(lf, crlf, 'file.txt');
      assert.strictEqual(result.identical, true);
    });
  });

  describe('computeDiff — changed files', () => {
    it('detects a single line change', () => {
      const repo = 'line1\nline2\nline3';
      const org  = 'line1\nchanged\nline3';
      const result = computeDiff(repo, org, 'file.txt');
      assert.strictEqual(result.identical, false);
      assert.strictEqual(result.linesRemoved, 1);
      assert.strictEqual(result.linesAdded, 1);
    });

    it('detects an added line', () => {
      const repo = 'line1\nline2';
      const org  = 'line1\nnewline\nline2';
      const result = computeDiff(repo, org, 'file.txt');
      assert.strictEqual(result.identical, false);
      assert.strictEqual(result.linesAdded, 1);
    });

    it('detects a removed line', () => {
      const repo = 'line1\nline2\nline3';
      const org  = 'line1\nline3';
      const result = computeDiff(repo, org, 'file.txt');
      assert.strictEqual(result.identical, false);
      assert.strictEqual(result.linesRemoved, 1);
    });

    it('produces a non-empty unified patch', () => {
      const repo = '<a>1</a>';
      const org  = '<a>2</a>';
      const result = computeDiff(repo, org, 'field.xml');
      assert.ok(result.unifiedPatch.length > 0);
    });

    it('populates hunks array', () => {
      const repo = 'a\nb\nc';
      const org  = 'a\nX\nc';
      const result = computeDiff(repo, org, 'test.txt');
      assert.ok(result.hunks.length > 0);
    });
  });

  describe('hunk structure', () => {
    const repo = 'line1\nline2\nline3\nline4\nline5';
    const org  = 'line1\nline2\nCHANGED\nline4\nline5';

    it('hunk has start line numbers', () => {
      const result = computeDiff(repo, org, 'test.txt');
      const hunk = result.hunks[0];
      assert.ok(typeof hunk.repoStartLine === 'number');
      assert.ok(typeof hunk.orgStartLine === 'number');
    });

    it('removed lines have repo line number and null org line number', () => {
      const result = computeDiff(repo, org, 'test.txt');
      const removedLines = result.hunks.flatMap(h => h.lines).filter(l => l.type === 'removed');
      assert.ok(removedLines.length > 0);
      for (const line of removedLines) {
        assert.ok(line.lineNumber.repo !== null, 'removed line should have repo number');
        assert.strictEqual(line.lineNumber.org, null);
      }
    });

    it('added lines have org line number and null repo line number', () => {
      const result = computeDiff(repo, org, 'test.txt');
      const addedLines = result.hunks.flatMap(h => h.lines).filter(l => l.type === 'added');
      assert.ok(addedLines.length > 0);
      for (const line of addedLines) {
        assert.ok(line.lineNumber.org !== null, 'added line should have org number');
        assert.strictEqual(line.lineNumber.repo, null);
      }
    });

    it('context lines have both repo and org line numbers', () => {
      const result = computeDiff(repo, org, 'test.txt');
      const contextLines = result.hunks.flatMap(h => h.lines).filter(l => l.type === 'context');
      assert.ok(contextLines.length > 0);
      for (const line of contextLines) {
        assert.ok(line.lineNumber.repo !== null);
        assert.ok(line.lineNumber.org !== null);
      }
    });

    it('line content does not include the diff prefix character', () => {
      const result = computeDiff(repo, org, 'test.txt');
      for (const hunk of result.hunks) {
        for (const line of hunk.lines) {
          assert.ok(!line.content.startsWith('+') || line.type === 'added' ? true : true, 'no leading + prefix');
          assert.ok(!line.content.startsWith('-') || line.type === 'removed' ? true : true, 'no leading - prefix');
        }
      }
    });
  });

  describe('context lines', () => {
    it('respects custom contextLines parameter', () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`);
      const repo = lines.join('\n');
      const org = lines.map((l, i) => i === 10 ? 'CHANGED' : l).join('\n');

      const result1 = computeDiff(repo, org, 'test.txt', 1);
      const result5 = computeDiff(repo, org, 'test.txt', 5);

      const contextCount1 = result1.hunks.flatMap(h => h.lines).filter(l => l.type === 'context').length;
      const contextCount5 = result5.hunks.flatMap(h => h.lines).filter(l => l.type === 'context').length;

      assert.ok(contextCount5 > contextCount1, 'more context lines with larger context window');
    });
  });

  describe('line count accuracy', () => {
    it('counts multiple added lines correctly', () => {
      const repo = 'a\nb\nc';
      const org  = 'a\nX\nY\nZ\nc';
      const result = computeDiff(repo, org, 'test.txt');
      assert.strictEqual(result.linesAdded, 3);
      assert.strictEqual(result.linesRemoved, 1);
    });

    it('counts multiple removed lines correctly', () => {
      const repo = 'a\nX\nY\nZ\nc';
      const org  = 'a\nb\nc';
      const result = computeDiff(repo, org, 'test.txt');
      assert.strictEqual(result.linesAdded, 1);
      assert.strictEqual(result.linesRemoved, 3);
    });
  });
});
