# Performance Guide

## Overview

Metadata drift detection on a large Salesforce org involves three expensive operations:
1. **MDAPI network retrieval** — calling Salesforce APIs
2. **XML parsing and normalisation** — CPU-intensive
3. **Diff computation** — CPU and memory intensive for large files

This guide explains the performance model, expected timings, and tuning strategies.

---

## Benchmark Reference

Approximate timings on a MacBook Pro M2 (8-core) with a 500 Mbps connection:

| Org Size | Components | Retrieval | Comparison | Total |
|---|---|---|---|---|
| Small | ~200 | ~30s | ~5s | ~35s |
| Medium | ~1,000 | ~2m | ~20s | ~2m 20s |
| Large | ~5,000 | ~10m | ~90s | ~11m 30s |
| Very Large | ~15,000 | ~30m | ~4m | ~34m |

*These are estimates. Actual times depend on org response times, component size, and network latency.*

---

## Retrieval Architecture

### Batch Strategy

The tool uses the MDAPI **`retrieve`** endpoint, not source-by-source REST calls. This is 10–50× more efficient for bulk operations.

Components are grouped by metadata type and split into batches of `--batch-size` (default: 500). Each batch becomes one MDAPI retrieve request.

```
Components: 4,700
Batch size: 500
→ 10 batches
→ Each batch: 1 retrieve call + 1 poll loop (avg 15–30s per batch)
→ Batches run: sequentially by default, or parallel with --parallel-batches N
```

### Parallel Batch Retrieval

By default, batches run sequentially to avoid hitting Salesforce's concurrent API limit (default: 25 concurrent long-running async requests). Use `--parallel-batches` cautiously:

```bash
# Safe parallel setting for most orgs
sf drift detect -o myOrg --parallel-batches 3

# Maximum (risk of LIMIT_EXCEEDED on busy orgs)
sf drift detect -o myOrg --parallel-batches 5
```

### Poll Interval

MDAPI retrieval is asynchronous. The tool polls for completion with exponential backoff:
- Start: 2s
- Max: 15s
- Timeout: `--retrieve-timeout` (default: 60s per batch)

---

## Comparison Architecture

### Concurrent Comparison

File comparison runs as concurrent async tasks using `p-limit`. Each task processes one component at a time. The concurrency limit is set by `--workers` (default: `os.cpus().length - 1`).

```
Orchestrator: dispatch tasks, aggregate results, write output
Task 1:       read + normalise + diff ApexClass/AccountController
Task 2:       read + normalise + diff ApexClass/LeadService
Task 3:       read + normalise + diff CustomObject/Account
...
```

Override concurrency with `--workers N`. Higher values help when files are small and I/O-bound; lower values help under memory pressure.

### XML Normalisation Strategy

For XML metadata, normalisation runs before diff to eliminate false positives from node reordering. The normaliser uses `fast-xml-parser` to parse both files into an AST, sort all nodes and object keys alphabetically, then serialise back to canonical XML.

Time complexity: O(n log n) per file where n = number of XML nodes (dominated by sort).

### Diff Algorithm

The tool uses the **Myers diff algorithm** via the `diff` npm package, which is O(ND) where N = file size and D = number of edits. For files with low drift (common case), this is very fast.

---

## Disk Space

Downloaded org metadata is stored in a temp directory (default: OS temp). Estimate:

- Average component size: 5–20 KB
- 1,000 components: ~5–20 MB
- 10,000 components: ~50–200 MB

Use `--temp-dir` to control where this lands, and `--keep-temp` to preserve it for inspection or repeated comparisons without re-downloading.

The temp directory is automatically cleaned up after each run unless `--keep-temp` is specified. Use `sf drift clean --all` to remove any leftover directories.

---

## CI/CD Optimisation

### Caching Retrieved Metadata

In CI, cache the retrieved org snapshot between runs to speed up repeated scans:

```yaml
# GitHub Actions example
- name: Cache org snapshot
  uses: actions/cache@v4
  with:
    path: .drift-cache
    key: org-snapshot-${{ env.ORG_ID }}-${{ github.run_id }}
    restore-keys: |
      org-snapshot-${{ env.ORG_ID }}-

- name: Run drift detection
  run: |
    sf drift detect -o myOrg \
      --temp-dir .drift-cache \
      --keep-temp \
      --format json \
      --output drift.json
```

### Incremental Scans

Use `--include-types` to only scan the types most likely to drift in a given PR context:

```bash
# PR only touches Apex — restrict the scan
sf drift detect -o myOrg --include-types ApexClass,ApexTrigger,ApexTestSuite
```

### No-Progress Mode

In CI environments, disable interactive progress bars to avoid polluting logs:

```bash
sf drift detect -o myOrg --no-progress
```

---

## Tuning Cheat Sheet

| Scenario | Recommendation |
|---|---|
| Timeouts on large org | `--batch-size 200 --retrieve-timeout 120000` |
| Slow comparison on many files | `--workers 8` (if CPU permits) |
| Low disk space | `--temp-dir /fast-ssd-path` |
| CI speed optimisation | `--no-progress --parallel-batches 3 --keep-temp` (with caching) |
| Quick targeted scan | `--include-types ApexClass,Flow` |
| Full audit scan | `--no-defaults-exclusion --report-org-only` |
