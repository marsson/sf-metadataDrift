# sf-data-drift

**Detect metadata drift between a Salesforce org and its Git repository.**

`sf-data-drift` is a Salesforce CLI plugin that compares every metadata component in your SFDX source repository against the live org and tells you exactly what has changed, what is missing, and what exists only in the org. It understands SFDX source format natively — decomposed objects, field subfolders, LWC bundles — and eliminates common false positives caused by XML node reordering or whitespace-only differences.

---

## Features

- **Source-format aware** — understands decomposed SFDX layout (`objects/Account/fields/`, `lwc/`, etc.)
- **False-positive free** — XML is normalised before comparison; node order and whitespace differences are ignored
- **Three output formats** — terminal table, JSON, and an interactive HTML report with side-by-side diffs
- **HTML report** — filter, search, dismiss irrelevant rows, then export the remaining items to CSV
- **Configurable exclusions** — Profiles, Permission Sets, and other volatile types are excluded by default
- **Progress bars** — real-time feedback during retrieval and comparison
- **CI-friendly** — `--json` and `--no-progress` flags for pipeline integration; exit code `1` when drift is found

---

## Requirements

| Requirement | Version |
|---|---|
| Node.js | ≥ 18 |
| Salesforce CLI (`sf`) | ≥ 2 |
| SFDX project | source format (decomposed) |

The target org must be authenticated via `sf org login` before running.

---

## Installation

### As a Salesforce CLI plugin (recommended)

```bash
sf plugins install @marsson/sf-data-drift
```

### From source

```bash
git clone https://github.com/marsson/sf-data-drift.git
cd sf-data-drift
npm install
npm run build
./bin/run.js drift detect --help
```

---

## Quick start

```bash
# Scan the current SFDX project against a sandbox
sf drift detect --target-org my-sandbox

# Scan a specific source directory (no sfdx-project.json needed)
sf drift detect --source-dir ./force-app --target-org my-sandbox

# Generate an interactive HTML report
sf drift detect --target-org my-sandbox --format html --output drift-report.html

# Preview what will be scanned without hitting the org
sf drift detect --target-org my-sandbox --dry-run
```

---

## Commands

### `sf drift detect`

Compares all metadata components in the repository against the live org.

```
USAGE
  sf drift detect -o <org> [flags]

FLAGS
  -o, --target-org=<value>        (required) Username or alias of the target org
      --source-dir=<value>...     Source directory to scan (repeatable; skips sfdx-project.json lookup)
      --project-dir=<value>       Path to SFDX project root (default: current directory)
      --format=table|json|html    Output format (default: table)
      --output=<value>            Write output to a file instead of stdout
      --include-types=<value>     Only compare these metadata types (comma-separated)
      --exclude-types=<value>     Exclude additional metadata types (comma-separated)
      --no-defaults-exclusion     Disable the built-in exclusion list
      --report-org-only           Also report components found in org but not in repo
      --batch-size=<value>        Components per MDAPI retrieval batch (default: 500)
      --retrieve-timeout=<value>  Retrieval timeout per batch in ms (default: 60000)
      --parallel-batches=<value>  Concurrent retrieval batches (default: 1, max: 5)
      --workers=<value>           Parallel comparison workers (default: CPU count − 1)
      --api-version=<value>       Override the Salesforce API version
      --temp-dir=<value>          Directory for downloaded org metadata
      --keep-temp                 Keep downloaded metadata after the run
      --dry-run                   Scan repository and list components without calling the org
      --no-progress               Suppress progress bars (recommended for CI)
      --verbose                   Enable verbose logging
      --json                      Output result as JSON (oclif standard)
```

**Exit codes:** `0` = no drift, `1` = drift detected, `2` = error.

---

### `sf drift init`

Creates a `.driftrc.json` configuration file in the project root with all available options pre-filled and commented.

```bash
sf drift init
sf drift init --project-dir /path/to/project --force
```

---

### `sf drift clean`

Removes temporary directories left behind by `--keep-temp`.

```bash
sf drift clean --temp-dir ./.drift-cache
sf drift clean --all    # removes all sf-data-drift-* dirs from the OS temp folder
```

---

## Output formats

### Table (default)

Colour-coded terminal table. Sorted by severity: `DELETED` → `CHANGED` → `ORG_ONLY`.

```
 Metadata Type          API Name                    Status    Δ Added  Δ Removed
 ─────────────────────────────────────────────────────────────────────────────────
 ApexClass              MyDeprecatedClass           DELETED   —        —
 CustomField            Account.OldField__c         DELETED   —        —
 Flow                   Onboarding_Flow             CHANGED   +24      -3
 CustomMetadata         Config.Production           CHANGED   +1       -1
```

### JSON

Full structured report including every hunk and line-level diff. Pipe-friendly.

```bash
sf drift detect -o my-sandbox --format json | jq '.summary'
```

```json
{
  "totalScanned": 2025,
  "totalDrifted": 47,
  "changed": 31,
  "deleted": 16,
  "orgOnly": 0,
  "unchanged": 1978
}
```

### HTML

Self-contained interactive report. No server or internet connection required.

- **Side-by-side diff** — click any `CHANGED` row to expand a syntax-highlighted diff
- **Filter** — search by name, filter by status or metadata type
- **Dismiss** — click `×` on any row to remove it from view (e.g. known/expected drift)
- **Restore** — bring all dismissed rows back with the ↩ button
- **Export CSV** — downloads a CSV of all currently visible (non-dismissed) rows

```bash
sf drift detect -o my-sandbox --format html --output report.html
open report.html
```

---

## Configuration file

Run `sf drift init` to generate a `.driftrc.json` in the project root. All settings are optional and can be overridden by CLI flags.

```jsonc
{
  "defaultFormat": "table",        // "table" | "json" | "html"
  "defaultOutput": null,           // path to write output file
  "batchSize": 500,                // components per MDAPI retrieval batch
  "retrieveTimeout": 60000,        // per-batch timeout in ms
  "parallelBatches": 1,            // concurrent retrieval batches (max 5)
  "workers": 4,                    // parallel comparison workers
  "apiVersion": null,              // e.g. "59.0" — null = auto-detect from org
  "verbose": false,
  "exclusions": {
    "useDefaults": true,           // apply the built-in exclusion list
    "additionalTypes": [],         // extra types to exclude
    "includeOverride": []          // re-include types from the default exclusion list
  },
  "ignorePatterns": [],            // micromatch globs relative to project root
  "comparison": {
    "xmlNormalization": true,      // sort XML nodes before diffing
    "ignoreWhitespace": true,      // ignore whitespace-only differences
    "ignoreComments": true,        // strip XML comments before diffing
    "contextLines": 5
  },
  "htmlReport": {
    "title": "Salesforce Drift Report",
    "theme": "light",
    "includeUnchanged": false,
    "syntaxHighlight": true
  }
}
```

Settings are resolved in this order (highest priority first):

```
CLI flags → SF_DRIFT_* environment variables → .driftrc.json → built-in defaults
```

---

## Environment variables

Every numeric and boolean setting can be provided via environment variable, useful for CI pipelines:

| Variable | Equivalent flag |
|---|---|
| `SF_DRIFT_TARGET_ORG` | `--target-org` |
| `SF_DRIFT_FORMAT` | `--format` |
| `SF_DRIFT_OUTPUT` | `--output` |
| `SF_DRIFT_BATCH_SIZE` | `--batch-size` |
| `SF_DRIFT_RETRIEVE_TIMEOUT` | `--retrieve-timeout` |
| `SF_DRIFT_WORKERS` | `--workers` |
| `SF_DRIFT_VERBOSE` | `--verbose` |
| `SF_DRIFT_API_VERSION` | `--api-version` |

---

## Default exclusions

The following types are excluded by default because they are environment-specific and change frequently:

| Type | Reason |
|---|---|
| `Profile` | Highly environment-specific; changes on every permission edit |
| `PermissionSet` | Managed separately; volatile |
| `PermissionSetGroup` | Same as above |
| `MutingPermissionSet` | Same as above |
| `CustomPermission` | Same as above |
| `Settings` | Org-level settings; not deployable metadata |
| `InstalledPackage` | Managed package artefacts |
| `StandardValueSet` | Read-only standard picklists |
| `StandardValueSetTranslation` | Same as above |
| `AIApplication` / `AIApplicationConfig` | Einstein configuration |
| `LightningExperienceTheme` | Branding; org-specific |
| `Network` / `NetworkBranding` | Experience Cloud; org-specific |

To include any of these, use `--no-defaults-exclusion` or set `includeOverride` in `.driftrc.json`.

---

## How it works

```
Repository (SFDX source format)
        │
        ▼
  ① Scan source dirs
    Resolve metadata types from file paths
    (objects/Account/fields/ → CustomField:Account.*)
        │
        ▼
  ② Batch & retrieve from org
    ComponentSet.retrieve() via Metadata API
    SDR converts MDAPI response → source format automatically
        │
        ▼
  ③ Compare file pairs
    XML: normalise node order → diff
    All files: detect whitespace-only differences → ignore
        │
        ▼
  ④ Report
    Table · JSON · HTML
```

---

## CI/CD integration

```yaml
# GitHub Actions example
- name: Check metadata drift
  run: |
    sf drift detect \
      --target-org ${{ secrets.SF_ORG_ALIAS }} \
      --format json \
      --no-progress \
      --output drift-report.json
  continue-on-error: true   # collect report even on drift

- name: Upload drift report
  uses: actions/upload-artifact@v4
  with:
    name: drift-report
    path: drift-report.json
```

The command exits with code `1` when drift is detected, making it straightforward to fail a pipeline step or send an alert.

---

## Supported metadata types

`sf-data-drift` recognises over 60 metadata file suffixes out of the box, including:

ApexClass · ApexTrigger · ApexPage · Flow · FlexiPage · CustomObject · CustomField · ValidationRule · RecordType · Layout · ListView · CustomMetadata · CustomLabel · StaticResource · LightningComponentBundle · AuraDefinitionBundle · PermissionSet · Profile · Report · Dashboard · and more.

Custom types registered in SDR are also supported through the `ComponentSet` API.

---

## License

MIT — see [LICENSE](LICENSE).

---

*Built by Marsson*
