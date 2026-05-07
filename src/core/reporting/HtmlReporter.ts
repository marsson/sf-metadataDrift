import * as fs from 'fs';
import * as path from 'path';
import { renderComponentDiff } from './HtmlDiffRenderer';
import { formatDuration } from '../../utils/FileUtils';
import type { Reporter } from './Reporter';
import type { DriftReport, DriftResult } from '../../types/DriftReport';
import type { ReporterConfig } from '../../types/Config';

function loadAsset(modulePath: string, fallback = ''): string {
  try {
    return fs.readFileSync(require.resolve(modulePath), 'utf8');
  } catch {
    return fallback;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function statusBadge(status: string): string {
  const classes: Record<string, string> = {
    CHANGED: 'badge-changed',
    DELETED: 'badge-deleted',
    ORG_ONLY: 'badge-org-only',
  };
  return `<span class="badge ${classes[status] ?? ''}">${escapeHtml(status)}</span>`;
}

function renderRow(r: DriftResult, index: number): string {
  const diffHtml = r.status === 'CHANGED' ? renderComponentDiff(r) : '';
  const hasDiff = diffHtml.length > 0;
  const lines = r.status === 'CHANGED'
    ? `<span class="lines-added">+${r.linesAdded}</span> <span class="lines-removed">-${r.linesRemoved}</span>`
    : '<span class="na">—</span>';

  return `
    <tr class="component-row" data-type="${escapeHtml(r.metadataType)}" data-status="${r.status}"
        data-index="${index}" data-name="${escapeHtml(r.apiName)}"
        data-added="${r.linesAdded}" data-removed="${r.linesRemoved}">
      <td class="col-type">${escapeHtml(r.metadataType)}</td>
      <td class="col-name" ${hasDiff ? 'onclick="toggleDiff(this.closest(\'tr\'))" style="cursor:pointer"' : ''}>${escapeHtml(r.apiName)}${hasDiff ? ' <span class="expand-icon">▶</span>' : ''}</td>
      <td class="col-status">${statusBadge(r.status)}</td>
      <td class="col-lines">${lines}</td>
      <td class="col-dismiss"><button class="btn-dismiss" onclick="dismissRow(event, ${index})" title="Remove from view">×</button></td>
    </tr>
    ${hasDiff ? `<tr class="diff-row" id="diff-${index}" style="display:none"><td colspan="5"><div class="diff-container">${diffHtml}</div></td></tr>` : ''}`;
}

const STYLES = `
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; color: #212529; }
  .header { background: #0d1117; color: #c9d1d9; padding: 24px 32px; border-bottom: 1px solid #30363d; }
  .header h1 { font-size: 20px; font-weight: 600; color: #f0f6fc; }
  .header .meta { font-size: 13px; color: #8b949e; margin-top: 6px; }
  .summary { display: flex; gap: 16px; padding: 20px 32px; flex-wrap: wrap; align-items: center; }
  .stat-card { background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 16px 20px; min-width: 130px; }
  .stat-card .value { font-size: 28px; font-weight: 700; }
  .stat-card .label { font-size: 12px; color: #6c757d; margin-top: 4px; text-transform: uppercase; letter-spacing: .5px; }
  .stat-changed .value { color: #f6c90e; }
  .stat-deleted .value { color: #dc3545; }
  .stat-clean   .value { color: #28a745; }
  .stat-total   .value { color: #0d6efd; }
  .filters { padding: 12px 32px; background: white; border-bottom: 1px solid #dee2e6; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .filters input { border: 1px solid #ced4da; border-radius: 6px; padding: 6px 12px; font-size: 14px; width: 240px; }
  .filters select { border: 1px solid #ced4da; border-radius: 6px; padding: 6px 12px; font-size: 14px; }
  .filters label { font-size: 13px; color: #495057; }
  .filters .spacer { flex: 1; }
  .btn-export { background: #0d6efd; color: white; border: none; border-radius: 6px; padding: 7px 16px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; }
  .btn-export:hover { background: #0b5ed7; }
  .btn-restore { background: #6c757d; color: white; border: none; border-radius: 6px; padding: 7px 14px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .btn-restore:hover { background: #5a6268; }
  .row-count { font-size: 13px; color: #6c757d; white-space: nowrap; }
  .row-count strong { color: #212529; }
  .container { padding: 20px 32px; }
  table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden; font-size: 13px; }
  thead tr { background: #f8f9fa; border-bottom: 2px solid #dee2e6; }
  th { padding: 10px 14px; text-align: left; font-weight: 600; color: #495057; font-size: 12px; text-transform: uppercase; letter-spacing: .4px; }
  tbody tr.component-row:hover { background: #f8f9fa; }
  td { padding: 10px 14px; border-bottom: 1px solid #f1f3f4; vertical-align: middle; }
  .col-type { color: #6c757d; font-size: 12px; width: 180px; }
  .col-name { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; }
  .col-status { width: 100px; }
  .col-lines { width: 120px; font-family: monospace; font-size: 12px; }
  .col-dismiss { width: 36px; text-align: center; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
  .badge-changed { background: #fff3cd; color: #856404; }
  .badge-deleted { background: #f8d7da; color: #721c24; }
  .badge-org-only { background: #cff4fc; color: #055160; }
  .lines-added  { color: #28a745; font-weight: 600; }
  .lines-removed { color: #dc3545; font-weight: 600; }
  .na { color: #adb5bd; }
  .expand-icon { color: #6c757d; font-size: 10px; transition: transform .2s; display: inline-block; margin-left: 4px; }
  tr.expanded .expand-icon { transform: rotate(90deg); }
  .diff-row td { padding: 0; background: #f8f9fa; }
  .diff-container { border-top: 1px solid #dee2e6; overflow-x: auto; }
  .diff-container .d2h-wrapper { margin: 0; }
  .btn-dismiss { background: none; border: none; color: #adb5bd; font-size: 16px; line-height: 1; cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: color .15s, background .15s; }
  .btn-dismiss:hover { color: #dc3545; background: #fff0f0; }
  .section-title { font-size: 15px; font-weight: 600; margin: 24px 0 12px; color: #212529; }
  footer { padding: 20px 32px; font-size: 12px; color: #adb5bd; border-top: 1px solid #dee2e6; margin-top: 32px; }
  .hidden { display: none !important; }
</style>`;

const SCRIPTS = `
<script>
var dismissed = new Set();

function toggleDiff(row) {
  var idx = row.getAttribute('data-index');
  var diffRow = document.getElementById('diff-' + idx);
  if (!diffRow) return;
  var isOpen = diffRow.style.display !== 'none';
  diffRow.style.display = isOpen ? 'none' : 'table-row';
  row.classList.toggle('expanded', !isOpen);
}

function dismissRow(event, idx) {
  event.stopPropagation();
  dismissed.add(idx);
  var row = document.querySelector('tr.component-row[data-index="' + idx + '"]');
  var diffRow = document.getElementById('diff-' + idx);
  if (row) row.classList.add('hidden');
  if (diffRow) { diffRow.style.display = 'none'; diffRow.classList.add('hidden'); }
  updateRowCount();
}

function restoreDismissed() {
  dismissed.clear();
  document.querySelectorAll('tr.component-row').forEach(function(row) {
    row.dataset.dismissed = '';
    row.classList.remove('hidden');
  });
  document.querySelectorAll('tr.diff-row').forEach(function(r) {
    r.classList.remove('hidden');
  });
  applyFilters();
}

function applyFilters() {
  var search = document.getElementById('search').value.toLowerCase();
  var statusFilter = document.getElementById('status-filter').value;
  var typeFilter = document.getElementById('type-filter').value;
  document.querySelectorAll('tr.component-row').forEach(function(row) {
    var idx = parseInt(row.getAttribute('data-index'), 10);
    if (dismissed.has(idx)) { row.classList.add('hidden'); return; }
    var name = row.querySelector('.col-name').textContent.toLowerCase();
    var type = row.getAttribute('data-type');
    var status = row.getAttribute('data-status');
    var matchSearch = !search || name.includes(search) || type.toLowerCase().includes(search);
    var matchStatus = !statusFilter || status === statusFilter;
    var matchType = !typeFilter || type === typeFilter;
    var visible = matchSearch && matchStatus && matchType;
    row.classList.toggle('hidden', !visible);
    var diffRow = document.getElementById('diff-' + idx);
    if (diffRow) {
      if (!visible) { diffRow.style.display = 'none'; row.classList.remove('expanded'); diffRow.classList.add('hidden'); }
      else { diffRow.classList.remove('hidden'); }
    }
  });
  updateRowCount();
}

function updateRowCount() {
  var all = document.querySelectorAll('tr.component-row');
  var visible = Array.from(all).filter(function(r) { return !r.classList.contains('hidden'); }).length;
  var el = document.getElementById('row-count');
  if (el) el.innerHTML = '<strong>' + visible + '</strong> of <strong>' + all.length + '</strong> shown';
}

function exportCSV() {
  var rows = Array.from(document.querySelectorAll('tr.component-row')).filter(function(r) {
    return !r.classList.contains('hidden');
  });
  var lines = [['Metadata Type', 'API Name', 'Status', 'Lines Added', 'Lines Removed'].map(q).join(',')];
  rows.forEach(function(row) {
    lines.push([
      q(row.getAttribute('data-type') || ''),
      q(row.getAttribute('data-name') || ''),
      q(row.getAttribute('data-status') || ''),
      q(row.getAttribute('data-added') || '0'),
      q(row.getAttribute('data-removed') || '0')
    ].join(','));
  });
  var csv = lines.join('\\r\\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'drift-report.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function q(s) {
  s = String(s).replace(/"/g, '""');
  return /[,\\r\\n"]/.test(s) ? '"' + s + '"' : s;
}

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('search').addEventListener('input', applyFilters);
  document.getElementById('status-filter').addEventListener('change', applyFilters);
  document.getElementById('type-filter').addEventListener('change', applyFilters);
  updateRowCount();
});
</script>`;

export class HtmlReporter implements Reporter {
  async generate(report: DriftReport, config: ReporterConfig): Promise<void> {
    const title = config.htmlOptions?.title ?? 'Salesforce Drift Report';
    const diff2htmlCss = loadAsset('diff2html/bundles/css/diff2html.min.css');
    const highlightCss = loadAsset('highlight.js/styles/github.min.css');

    const types = Array.from(new Set(report.components.map(c => c.metadataType))).sort();
    const typeOptions = types.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('\n');

    const duration = formatDuration(report.meta.scanDurationMs);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  ${STYLES}
  <style>${diff2htmlCss}</style>
  <style>${highlightCss}</style>
</head>
<body>

<div class="header">
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    Org: <strong>${escapeHtml(report.meta.orgAlias)}</strong> (${escapeHtml(report.meta.orgId)})
    &nbsp;·&nbsp; API: ${escapeHtml(report.meta.apiVersion)}
    &nbsp;·&nbsp; Generated: ${new Date(report.meta.generatedAt).toLocaleString()}
    &nbsp;·&nbsp; Duration: ${duration}
  </div>
</div>

<div class="summary">
  <div class="stat-card stat-total">
    <div class="value">${report.summary.totalScanned}</div>
    <div class="label">Scanned</div>
  </div>
  <div class="stat-card stat-changed">
    <div class="value">${report.summary.changed}</div>
    <div class="label">Changed</div>
  </div>
  <div class="stat-card stat-deleted">
    <div class="value">${report.summary.deleted}</div>
    <div class="label">Deleted</div>
  </div>
  <div class="stat-card stat-clean">
    <div class="value">${report.summary.unchanged}</div>
    <div class="label">Unchanged</div>
  </div>
</div>

<div class="filters">
  <label>Search: <input id="search" type="text" placeholder="Component name or type…"></label>
  <label>Status: <select id="status-filter">
    <option value="">All</option>
    <option value="CHANGED">CHANGED</option>
    <option value="DELETED">DELETED</option>
    <option value="ORG_ONLY">ORG_ONLY</option>
  </select></label>
  <label>Type: <select id="type-filter">
    <option value="">All types</option>
    ${typeOptions}
  </select></label>
  <div class="spacer"></div>
  <span class="row-count" id="row-count"></span>
  <button class="btn-restore" onclick="restoreDismissed()" title="Restore all dismissed rows">↩ Restore</button>
  <button class="btn-export" onclick="exportCSV()">⬇ Export CSV</button>
</div>

<div class="container">
  ${report.summary.totalDrifted > 0 ? `
  <div class="section-title">Drifted Components (${report.summary.totalDrifted})</div>
  <table>
    <thead>
      <tr>
        <th>Metadata Type</th>
        <th>API Name</th>
        <th>Status</th>
        <th>Lines Δ</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      ${report.components.map((r, i) => renderRow(r, i)).join('\n')}
    </tbody>
  </table>
  ` : `<p style="color:#28a745;font-weight:600;padding:20px 0">✔ No drift detected — org matches repository perfectly.</p>`}
</div>

<footer>
  sf-data-drift by Marsson &nbsp;·&nbsp; v${escapeHtml(report.meta.toolVersion)}
  &nbsp;·&nbsp; ${escapeHtml(report.meta.projectDir)}
</footer>

${SCRIPTS}

</body>
</html>`;

    const outputFile = config.outputFile;
    if (outputFile) {
      await fs.promises.writeFile(outputFile, html, 'utf8');
      const size = Math.round(html.length / 1024);
      process.stdout.write(`  → Saved HTML report to ${path.resolve(outputFile)} (${size} KB)\n`);
    } else {
      process.stdout.write(html);
    }
  }
}
