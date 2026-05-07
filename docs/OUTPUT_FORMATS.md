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

Printed to stdout. Colour-coded when the terminal supports ANSI colours.

```
Retrieving from org...  ████████████░░░░░░░░  2/5 batches

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
Duration: 2m 31s  |  API version: 59.0  |  Org: production (00D...)
```

Status colour coding:
- **CHANGED** — yellow
- **DELETED** — red
- **ORG_ONLY** — cyan (when `--report-org-only` is set)

Results are sorted by severity: `DELETED` → `CHANGED` → `ORG_ONLY`.

---

## JSON Format

A single JSON object written to stdout or a file.

### Schema

```typescript
interface DriftReport {
  meta: ReportMeta;
  summary: ReportSummary;
  components: DriftResult[];
}

interface ReportMeta {
  generatedAt: string;        // ISO 8601 timestamp
  apiVersion: string;         // e.g. "59.0"
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

interface DriftResult {
  manifestKey: string;        // "MetadataType:ApiName"
  metadataType: string;       // e.g. "ApexClass"
  apiName: string;            // e.g. "AccountController"
  status: "CHANGED" | "DELETED" | "ORG_ONLY";
  repoFilePaths: string[];
  orgFilePaths: string[];
  linesAdded: number;
  linesRemoved: number;
  hunks: DiffHunk[];
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
    "generatedAt": "2026-05-08T14:32:01.442Z",
    "apiVersion": "59.0",
    "orgId": "00D5g000000XyzAB",
    "orgAlias": "production",
    "projectDir": "/Users/dev/my-sfdx-project",
    "scanDurationMs": 151200,
    "toolVersion": "0.1.0"
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
      "manifestKey": "ApexClass:AccountController",
      "metadataType": "ApexClass",
      "apiName": "AccountController",
      "status": "CHANGED",
      "repoFilePaths": ["force-app/main/default/classes/AccountController.cls-meta.xml"],
      "orgFilePaths": ["/tmp/sf-metadata-drift-abc/classes/AccountController.cls-meta.xml"],
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
      "manifestKey": "CustomField:Contact.Budget__c",
      "metadataType": "CustomField",
      "apiName": "Contact.Budget__c",
      "status": "DELETED",
      "repoFilePaths": ["force-app/main/default/objects/Contact/fields/Budget__c.field-meta.xml"],
      "orgFilePaths": [],
      "linesAdded": 0,
      "linesRemoved": 0,
      "hunks": []
    }
  ]
}
```

---

## HTML Format

A fully self-contained HTML file with embedded CSS and JavaScript. No internet connection required to view.

### Report Sections

#### 1. Header / Summary Dashboard

- Report title, org name, generation timestamp, scan duration
- Key metrics: components scanned, changed, deleted, unchanged

#### 2. Drift Table

- Filter by status (`CHANGED`, `DELETED`, `ORG_ONLY`) via dropdown
- Filter by metadata type via dropdown (populated from the report data)
- Full-text search on API name and type
- **Dismiss** (`×` button) — removes individual rows from view (e.g. known/expected drift)
- **Restore** (`↩` button) — brings all dismissed rows back
- **Export CSV** — downloads a CSV of all currently visible (non-dismissed) rows
- Live row counter showing visible vs total

#### 3. Inline Side-by-Side Diff (per component)

Expandable per row for `CHANGED` components. Click the API name to toggle. Shows:
- Left pane: **Repo** (expected state) with red highlighted removed lines
- Right pane: **Org** (actual state) with green highlighted added lines
- Line numbers in both panes
- Syntax highlighting

### Technology Stack (all inlined)

| Library | Version | Purpose |
|---|---|---|
| `diff2html` | 3.x | Side-by-side diff rendering |
| `highlight.js` | 11.x | Syntax highlighting (diff2html integration) |
| Custom CSS/JS | — | Layout, filters, dismiss/restore/CSV logic |

All dependencies are bundled into the output HTML at generation time. File size estimate: 350–500 KB base + ~2 KB per drifted component.

### CSV Export Format

The exported CSV contains one row per visible (non-dismissed) component:

```
Metadata Type,API Name,Status,Lines Added,Lines Removed
ApexClass,AccountController,CHANGED,8,3
CustomField,Contact.Budget__c,DELETED,0,0
```
