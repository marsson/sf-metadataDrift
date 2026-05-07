# Usage Guide

## Command Reference

### `sf drift detect`

The primary command. Compares repository metadata against a live Salesforce org and reports all drift.

```
USAGE
  $ sf drift detect [--project-dir <path>] [--source-dir <path>...]
                    -o <alias|username> [--format table|json|html]
                    [--output <file>] [--batch-size <number>]
                    [--retrieve-timeout <ms>] [--parallel-batches <number>]
                    [--workers <number>] [--include-types <type,...>]
                    [--exclude-types <type,...>] [--report-org-only]
                    [--no-defaults-exclusion] [--temp-dir <path>]
                    [--keep-temp] [--dry-run] [--api-version <version>]
                    [--verbose] [--no-progress]

FLAGS
  -o, --target-org=<value>          (required) Alias or username of the target org
      --project-dir=<path>          Path to the SFDX project root (default: current directory)
      --source-dir=<path>...        One or more explicit source directories (overrides project-dir scan)
      --format=<option>             Output format: table (default), json, html [default: table]
      --output=<file>               Write output to file instead of stdout
      --batch-size=<number>         Components per MDAPI retrieval batch [default: 500]
      --retrieve-timeout=<ms>       MDAPI retrieve timeout per batch in milliseconds [default: 60000]
      --parallel-batches=<number>   Concurrent retrieval batches [default: 1, max: 5]
      --workers=<number>            Concurrent comparison tasks [default: CPU count - 1]
      --include-types=<type,...>    Only compare these metadata types (comma-separated)
      --exclude-types=<type,...>    Exclude these metadata types (in addition to defaults)
      --report-org-only             Include components found in org but not in repo
      --no-defaults-exclusion       Disable the default exclusion list (profiles, permission sets, etc.)
      --temp-dir=<path>             Directory for downloaded org metadata [default: OS temp]
      --keep-temp                   Do not delete downloaded org metadata after run
      --dry-run                     Scan repository and print component list without calling org
      --api-version=<version>       Salesforce API version to use [default: org max]
      --verbose                     Enable verbose logging
      --no-progress                 Suppress progress bars (useful for CI)
```

---

## Examples

### Basic Usage

```bash
# Scan project in current directory against org alias "myOrg"
sf drift detect -o myOrg

# Specify project directory explicitly
sf drift detect --project-dir /path/to/my/sfdx-project -o myOrg

# Scan a specific subdirectory only (no sfdx-project.json required)
sf drift detect --source-dir ./force-app/main/default -o myOrg
```

### Output Formats

```bash
# Default table output to terminal
sf drift detect -o myOrg

# Save table output to file
sf drift detect -o myOrg --output drift-summary.txt

# JSON output (machine-readable, CI/CD pipelines)
sf drift detect -o myOrg --format json --output drift.json

# HTML report (full visual diff, share with stakeholders)
sf drift detect -o myOrg --format html --output reports/drift-$(date +%F).html
```

### Scoping the Scan

```bash
# Only check Apex classes and triggers
sf drift detect -o myOrg --include-types ApexClass,ApexTrigger

# Exclude flows (in addition to default exclusions)
sf drift detect -o myOrg --exclude-types Flow,FlowDefinition

# Disable all default exclusions (includes profiles, permission sets, etc.)
sf drift detect -o myOrg --no-defaults-exclusion

# Include profiles only, keep all other defaults active
# Note: use .driftrc.json exclusions.includeOverride for this — --no-defaults-exclusion removes ALL defaults
```

### Performance Tuning

```bash
# Large org: reduce batch size to avoid timeouts
sf drift detect -o myOrg --batch-size 200 --retrieve-timeout 120000

# Faster retrieval: run 3 batches concurrently
sf drift detect -o myOrg --parallel-batches 3

# More concurrent comparisons
sf drift detect -o myOrg --workers 8

# Keep downloaded metadata for inspection or re-runs
sf drift detect -o myOrg --keep-temp --temp-dir ./org-snapshot
```

### Dry Run (Scope Preview)

```bash
# See what would be scanned without hitting the org
sf drift detect -o myOrg --dry-run

# Dry run with specific types
sf drift detect -o myOrg --dry-run --include-types ApexClass,CustomObject
```

---

## `sf drift init`

Initialises a `.driftrc.json` configuration file in the project root with all options pre-filled.

```bash
sf drift init
sf drift init --project-dir /path/to/project
sf drift init --force   # overwrite existing file without prompting
```

See [CONFIGURATION.md](./CONFIGURATION.md) for all options.

---

## `sf drift clean`

Removes cached/temporary org snapshots left by `--keep-temp`.

```bash
sf drift clean --temp-dir ./org-snapshot
# or clean all drift temp directories from OS temp folder
sf drift clean --all
# skip confirmation prompt
sf drift clean --all --force
```

---

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | Completed successfully — no drift detected |
| `1` | Completed successfully — drift detected (components changed or deleted) |
| `2` | Error — retrieval or comparison failed |

Use exit codes in CI scripts to fail builds when drift is detected:
```bash
sf drift detect -o myOrg --no-progress
if [ $? -eq 1 ]; then
  echo "Drift detected — review before deploying"
  exit 1
fi
```

---

## Reading the Table Output

```
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
Summary: 6 drifted (4 changed · 2 deleted) of 847 scanned — 2m 31s
```

**Column explanations:**
- **Metadata Type**: Salesforce metadata type (matches `sfdx-project.json` type names)
- **API Name**: The component's API name as it appears in the org
- **Status**: `CHANGED` (exists in both, differs) or `DELETED` (in repo, missing in org)
- **Δ Lines**: Added and removed line count (only meaningful for `CHANGED` items)

Results are sorted by severity: `DELETED` first, then `CHANGED`, then `ORG_ONLY`.

---

## Environment Variables

All major settings can be provided via environment variables, prefixed with `SF_DRIFT_`:

| Variable | Equivalent Flag |
|---|---|
| `SF_DRIFT_TARGET_ORG` | `--target-org` |
| `SF_DRIFT_FORMAT` | `--format` |
| `SF_DRIFT_OUTPUT` | `--output` |
| `SF_DRIFT_BATCH_SIZE` | `--batch-size` |
| `SF_DRIFT_RETRIEVE_TIMEOUT` | `--retrieve-timeout` |
| `SF_DRIFT_PARALLEL_BATCHES` | `--parallel-batches` |
| `SF_DRIFT_WORKERS` | `--workers` |
| `SF_DRIFT_API_VERSION` | `--api-version` |
| `SF_DRIFT_REPORT_ORG_ONLY` | `--report-org-only` |
| `SF_DRIFT_VERBOSE` | `--verbose` (set to `true`) |
