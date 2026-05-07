# sf-data-drift — Salesforce Metadata Drift Detector

**sf-data-drift** is a Salesforce CLI plugin that measures the metadata drift between a Git repository (source-of-truth) and a live Salesforce org. It answers the question: *"How far has this org deviated from what we have in version control?"*

---

## What is Metadata Drift?

Metadata drift occurs when changes are made directly to a Salesforce org — via the Setup UI, quick fixes, sandbox promotions, or ad-hoc deployments — without those changes being reflected back into the version-controlled repository. Over time this divergence grows until it becomes a deployment risk: a deploy from the repo may overwrite or destroy configuration that exists only in the org.

This tool makes drift visible, measurable, and actionable.

---

## Key Features

| Feature | Description |
|---|---|
| **Full repository traversal** | Respects `sfdx-project.json` package directories; handles all source-format layouts |
| **Live org retrieval** | Downloads all in-scope components directly from the target org via MDAPI |
| **XML-aware comparison** | Normalises XML node ordering before diffing — avoids false positives |
| **Three output formats** | Table (terminal), JSON (machine-readable), HTML (visual side-by-side diff) |
| **Smart exclusions** | Profiles and Permission Sets excluded by default (configurable) |
| **Performance-first** | Batched retrieval, parallel workers, streaming I/O — handles orgs with 10,000+ components |
| **Staged retrieval** | Handles API limits by splitting retrieval into configurable batch sizes |

---

## Quick Start

```bash
# Install the plugin
sf plugins install @flightcentre/sf-data-drift

# Basic drift detection (table output, printed to terminal)
--
# Full project scan, output as HTML report
sf drift detect --project-dir . --target-org myOrg --format html --output ./reports/drift-$(date +%F).html

# JSON output for CI pipeline consumption
sf drift detect --project-dir . --target-org myOrg --format json --output drift.json
```

---

## Concepts

### Change Status Values

| Status | Meaning |
|---|---|
| `CHANGED` | Component exists in both repo and org but content differs |
| `DELETED` | Component exists in repo but is **absent from the org** |
| `ORG_ONLY` | Component exists in org but is **absent from the repo** |

> `ORG_ONLY` components are not reported by default. Enable with `--report-org-only`.

### Component Scope

The tool derives its component list from the repository. Only components present in the repo are checked against the org. This is intentional: the tool answers "what has drifted from what I know about", not "what is in the org".

---

## Output Summary

### Table (default)

```
┌──────────────────────────────┬───────────────────────────┬─────────┬───────────┐
│ Type                         │ Component                 │ Status  │ Δ Lines   │
├──────────────────────────────┼───────────────────────────┼─────────┼───────────┤
│ CustomObject                 │ Account                   │ CHANGED │ +4 / -2   │
│ ApexClass                    │ AccountService            │ CHANGED │ +12 / -5  │
│ CustomField                  │ Contact.PreferredChannel  │ DELETED │ —         │
│ Flow                         │ Lead_Auto_Assign_V3       │ CHANGED │ +89 / -67 │
└──────────────────────────────┴───────────────────────────┴─────────┴───────────┘
4 components drifted (3 changed, 1 deleted) — scan took 2m 14s
```

### HTML Report

The HTML report includes:
- Summary dashboard with drift statistics and charts
- Filterable, sortable table of all drifted components
- Side-by-side unified diff view for each changed component (syntax highlighted)
- Fully self-contained — no external CDN dependencies

### JSON

See [OUTPUT_FORMATS.md](./OUTPUT_FORMATS.md) for the full JSON schema.

---

## Documentation Index

| Document | Purpose |
|---|---|
| [INSTALLATION.md](./INSTALLATION.md) | How to install and authenticate |
| [USAGE.md](./USAGE.md) | All flags, arguments, and examples |
| [CONFIGURATION.md](./CONFIGURATION.md) | Config file, ignore rules, exclusions |
| [OUTPUT_FORMATS.md](./OUTPUT_FORMATS.md) | Detailed format specs and JSON schema |
| [PERFORMANCE.md](./PERFORMANCE.md) | Tuning for large orgs and CI pipelines |
| [EXCLUSIONS.md](./EXCLUSIONS.md) | Default excluded types and overrides |

---

## Compatibility

| Requirement | Minimum |
|---|---|
| Node.js | 18.x LTS |
| Salesforce CLI (`sf`) | v2.0+ |
| Salesforce API | v57.0 (Summer '23) |
| OS | macOS, Linux, Windows (WSL2 recommended) |

---

## Licence

MIT — see `LICENSE`.
