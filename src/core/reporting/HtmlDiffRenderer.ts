import { html as diff2html } from 'diff2html';
import type { DriftResult } from '../../types/DriftReport';

export function renderComponentDiff(component: DriftResult): string {
  if (component.hunks.length === 0) return '';

  const unified = hunksToUnifiedDiff(component);
  if (!unified) return '';

  try {
    return diff2html(unified, {
      outputFormat: 'side-by-side',
      matching: 'lines',
      renderNothingWhenEmpty: true,
      diffStyle: 'word',
    });
  } catch {
    return `<pre class="diff-error">Diff rendering failed for ${component.apiName}</pre>`;
  }
}

function hunksToUnifiedDiff(component: DriftResult): string {
  const repoFile = component.repoFilePaths[0] ?? component.apiName;
  const orgFile = component.orgFilePaths[0] ?? component.apiName;

  const lines: string[] = [
    `--- a/${repoFile}`,
    `+++ b/${orgFile}`,
  ];

  for (const hunk of component.hunks) {
    const repoCount = hunk.lines.filter(l => l.type !== 'added').length;
    const orgCount = hunk.lines.filter(l => l.type !== 'removed').length;
    lines.push(`@@ -${hunk.repoStartLine},${repoCount} +${hunk.orgStartLine},${orgCount} @@`);

    for (const line of hunk.lines) {
      switch (line.type) {
        case 'removed':
          lines.push(`-${line.content}`);
          break;
        case 'added':
          lines.push(`+${line.content}`);
          break;
        case 'context':
          lines.push(` ${line.content}`);
          break;
      }
    }
  }

  return lines.join('\n');
}
