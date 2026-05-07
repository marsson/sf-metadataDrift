import { createTwoFilesPatch } from 'diff';
import type { DiffHunk, DiffLine } from '../../types/DriftReport';

export interface DiffComputeResult {
  identical: boolean;
  linesAdded: number;
  linesRemoved: number;
  hunks: DiffHunk[];
  unifiedPatch: string;
}

export function computeDiff(
  repoContent: string,
  orgContent: string,
  filename: string,
  contextLines = 5
): DiffComputeResult {
  const normalizedRepo = repoContent.replace(/\r\n/g, '\n');
  const normalizedOrg = orgContent.replace(/\r\n/g, '\n');

  if (normalizedRepo === normalizedOrg) {
    return { identical: true, linesAdded: 0, linesRemoved: 0, hunks: [], unifiedPatch: '' };
  }

  const patch = createTwoFilesPatch(
    `a/${filename}`,
    `b/${filename}`,
    normalizedRepo,
    normalizedOrg,
    '',
    '',
    { context: contextLines }
  );

  const hunks = parseUnifiedPatch(patch);
  let linesAdded = 0;
  let linesRemoved = 0;

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'added') linesAdded++;
      if (line.type === 'removed') linesRemoved++;
    }
  }

  return {
    identical: false,
    linesAdded,
    linesRemoved,
    hunks,
    unifiedPatch: patch,
  };
}

function parseUnifiedPatch(patch: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  const lines = patch.split('\n');

  let currentHunk: DiffHunk | null = null;
  let repoLine = 0;
  let orgLine = 0;

  for (const line of lines) {
    // Skip file headers
    if (line.startsWith('---') || line.startsWith('+++')) continue;

    // Hunk header: @@ -a,b +c,d @@
    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      currentHunk = {
        repoStartLine: parseInt(hunkMatch[1], 10),
        orgStartLine: parseInt(hunkMatch[2], 10),
        repoLineCount: 0,
        orgLineCount: 0,
        lines: [],
      };
      hunks.push(currentHunk);
      repoLine = currentHunk.repoStartLine;
      orgLine = currentHunk.orgStartLine;
      continue;
    }

    if (!currentHunk) continue;

    if (line.startsWith('-')) {
      const diffLine: DiffLine = {
        type: 'removed',
        lineNumber: { repo: repoLine, org: null },
        content: line.slice(1),
      };
      currentHunk.lines.push(diffLine);
      currentHunk.repoLineCount++;
      repoLine++;
    } else if (line.startsWith('+')) {
      const diffLine: DiffLine = {
        type: 'added',
        lineNumber: { repo: null, org: orgLine },
        content: line.slice(1),
      };
      currentHunk.lines.push(diffLine);
      currentHunk.orgLineCount++;
      orgLine++;
    } else if (line.startsWith(' ') || line === '') {
      // Context line (space prefix or empty at end)
      if (line.startsWith(' ')) {
        const diffLine: DiffLine = {
          type: 'context',
          lineNumber: { repo: repoLine, org: orgLine },
          content: line.slice(1),
        };
        currentHunk.lines.push(diffLine);
        currentHunk.repoLineCount++;
        currentHunk.orgLineCount++;
        repoLine++;
        orgLine++;
      }
    }
  }

  return hunks;
}
