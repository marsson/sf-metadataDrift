# Output Formats

## Overview

The tool produces output in three formats selectable via `--format`:

| Format | Flag | Best For |
|---|---|---|
| Table | `--format table` (default) | Developer terminal review |
| JSON | `--format json` | CI/CD pipelines, scripting, tooling integration |
| HTML | `--format html` | Stakeholder reports, code review, audit trail |

---

## Table Format

Printed to stdout using `@oclif/table`. Respects terminal width.

```
Scanning repository...  ████████████████████  847 components found
Retrieving from org...  ████████████░░░░░░░░  2/5 batches complete

┌──────────────────────────────┬───────────────────────────────────┬──────────┬───────────┐
│ Metadata Type                │ API Name                          │ Status   │ Δ Lines   │
├──────────────────────────────┼───────────────────────────────────┼──────────┼───────────┤
│ ApexClass                    │ AccountController                 │ CHANGED  │ +8 / -3   │
│ ApexClass                    │ LeadService                       │ CHANGED  │ +45 / -22 │
│ CustomObject                 │ Opportunity__c                    │ CHANGED  │ +2 / -0   │
│ CustomField                  │ Contact.Budget__c                 │ DELETED  │ —         │
│ Flow                         │ Onboarding_Welcome_Email          │ DELETED  │ —         │
│ ValidationRule               │ Account.Phone_Required            │ CHANGED  │ +1 / -1   │
└──────────────────────────────┴───────────────────────────────────┴──────────┴───────────┘

Summary: 6 drifted (4 changed · 2 deleted) of 847 scanned
Scan duration: 2m 31s  |  API version: 59.0  |  Org: production (00D...)
```

The table is colour-coded when the terminal supports it:
- **CHANGED** — yellow
- **DELETED** — red
- **ORG_ONLY** — cyan (when `--report-org-only` is set)

---

## JSON Format

A single JSON object written to stdout or a file.

### Schema

```typescript
interface DriftReport {
  meta: ReportMeta;
  summary: ReportSummary;
  components: DriftedComponent[];
}

interface ReportMeta {
  generatedAt: string;        // ISO 8601 timestamp
  apiVersion: string;         // "59.0"
  orgId: string;              // Org 15-char ID
  orgAlias: string;
  projectDir: string;
  scanDurationMs: number;
  toolVersion: string;        // Plugin semver
}

interface ReportSummary {
  totalScanned: number;       // All components checked
  totalDrifted: number;       // changed + deleted + orgOnly
  changed: number;
  deleted: number;
  orgOnly: number;            // 0 unless --report-org-only
  unchanged: number;
}

interface DriftedComponent {
  metadataType: string;       // e.g. "ApexClass"
  apiName: string;            // e.g. "AccountController"
  status: "CHANGED" | "DELETED" | "ORG_ONLY";
  repoPath: string | null;    // Relative path from project root
  orgPath: string | null;     // Path in temp download dir (if --keep-temp)
  linesAdded: number | null;  // null if DELETED or ORG_ONLY
  linesRemoved: number | null;
  hunks: DiffHunk[] | null;   // null if DELETED or ORG_ONLY
}

interface DiffHunk {
  repoStartLine: number;
  orgStartLine: number;
  lines: DiffLine[];
}

interface DiffLine {
  type: "context" | "added" | "removed";
  lineNumber: {
    repo: number | null;
    org: number | null;
  };
  content: string;
}
```

### Example

```json
{
  "meta": {
    "generatedAt": "2026-05-07T14:32:01.442Z",
    "apiVersion": "59.0",
    "orgId": "00D5g000000XyzAB",
    "orgAlias": "production",
    "projectDir": "/Users/dev/my-sfdx-project",
    "scanDurationMs": 151200,
    "toolVersion": "1.2.0"
  },
  "summary": {
    "totalScanned": 847,
    "totalDrifted": 6,
    "changed": 4,
    "deleted": 2,
    "orgOnly": 0,
    "unchanged": 841
  },
  "components": [
    {
      "metadataType": "ApexClass",
      "apiName": "AccountController",
      "status": "CHANGED",
      "repoPath": "force-app/main/default/classes/AccountController.cls",
      "orgPath": null,
      "linesAdded": 8,
      "linesRemoved": 3,
      "hunks": [
        {
          "repoStartLine": 42,
          "orgStartLine": 42,
          "lines": [
            { "type": "context",  "lineNumber": { "repo": 42, "org": 42 }, "content": "    public static List<Account> getAccounts() {" },
            { "type": "removed",  "lineNumber": { "repo": 43, "org": null }, "content": "        return [SELECT Id, Name FROM Account LIMIT 100];" },
            { "type": "added",    "lineNumber": { "repo": null, "org": 43 }, "content": "        return [SELECT Id, Name, Phone FROM Account ORDER BY Name LIMIT 500];" },
            { "type": "context",  "lineNumber": { "repo": 44, "org": 44 }, "content": "    }" }
          ]
        }
      ]
    },
    {
      "metadataType": "CustomField",
      "apiName": "Contact.Budget__c",
      "status": "DELETED",
      "repoPath": "force-app/main/default/objects/Contact/fields/Budget__c.field-meta.xml",
      "orgPath": null,
      "linesAdded": null,
      "linesRemoved": null,
      "hunks": null
    }
  ]
}
```

---

## HTML Format

A fully self-contained HTML file with embedded CSS and JavaScript. No internet connection required to view.

### Report Sections

#### 1. Header / Summary Dashboard
- Report title, org name, generation timestamp
- Key metrics: components scanned, drifted, changed, deleted
- Donut chart showing drift breakdown by status
- Bar chart showing top 10 drifted metadata types

#### 2. Drift Table
- Sortable columns: Metadata Type, API Name, Status, Lines Added, Lines Removed
- Filterable by: type (multi-select), status (multi-select), text search on API name
- Colour-coded status badges
- Click row to expand inline diff

#### 3. Inline Side-by-Side Diff (per component)
Expandable per row. Shows:
- Left pane: **Repo** (expected state) with red highlighted removed lines
- Right pane: **Org** (actual state) with green highlighted added lines
- Synchronised scrolling between panes
- Line numbers in both panes
- Syntax highlighting based on metadata type (Apex → Java-like, XML → XML, etc.)

#### 4. Deleted Components Section
Separate table listing all `DELETED` components with their repo path. No diff pane (nothing to compare).

### HTML Technology Stack (all inlined)

| Library | Version | Purpose |
|---|---|---|
| `diff2html` | 3.x | Side-by-side diff rendering |
| `highlight.js` | 11.x | Syntax highlighting |
| `Chart.js` | 4.x | Summary charts |
| Custom CSS | — | Layout, dark/light theme |

All dependencies are bundled into the output HTML at generation time. File size estimate: 400KB base + ~2KB per drifted component.

### HTML Structure Outline

```html
<!DOCTYPE html>
<html>
<head>
  <!-- Inlined CSS (highlight.js theme + custom) -->
  <!-- Inlined fonts (base64) -->
</head>
<body>
  <header><!-- Title, org info, generation time --></header>
  
  <section id="summary">
    <!-- Metric cards -->
    <!-- Charts (Chart.js, inlined) -->
  </section>

  <section id="filters">
    <!-- Type filter, status filter, search box -->
  </section>

  <section id="drift-table">
    <table>
      <thead><!-- Sortable headers --></thead>
      <tbody>
        <!-- One <tr> per drifted component -->
        <!-- Expandable <tr class="diff-row"> with diff2html output -->
      </tbody>
    </table>
  </section>

  <section id="deleted-components">
    <!-- Table of DELETED components -->
  </section>

  <footer><!-- Tool version, scan metadata --></footer>

  <!-- Inlined JS (diff2html + Chart.js + interaction logic) -->
</body>
</html>
```

### Performance Characteristics

- For reports with >500 drifted components, diff panes are rendered lazily on first expand
- Virtual scrolling is used when `includeUnchanged: true` and the table exceeds 2000 rows
- Large diffs (>1000 lines) show a "Load full diff" button rather than rendering inline
