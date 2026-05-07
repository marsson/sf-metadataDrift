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
→ Each batch: 1 retrieve call + 1 poll loop (avg 15-30s per batch)
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

### Worker Thread Pool

File comparison runs in a pool of Node.js `worker_threads`. Each worker handles one component at a time:

```
Main thread: orchestrate, aggregate results, write output
Worker 1:    parse + normalise + diff ApexClass/AccountController
Worker 2:    parse + normalise + diff ApexClass/LeadService
Worker 3:    parse + normalise + diff CustomObject/Account
...
```

Default workers: `os.cpus().length - 1` (leaves one CPU for the main thread and OS). Override with `--workers N`.

### XML Normalisation Strategy

For XML metadata, normalisation runs before diff to eliminate false positives from node reordering. The normaliser uses `fast-xml-parser` (SAX-based, streaming) to avoid loading entire files into memory.

Time complexity: O(n log n) per file where n = number of XML nodes (dominated by sort).

### Diff Algorithm

The tool uses the **Myers diff algorithm** via the `diff` npm package, which is O(ND) where N = file size and D = number of edits. For files with low drift (common case), this is very fast.

For **very large files** (>50,000 lines), the tool automatically switches to a chunked diffing strategy that processes the file in segments and merges results, capping memory usage at ~50MB per worker.

---

## Memory Management

### Streaming I/O

Files are never fully loaded into memory during normalisation. The XML normaliser uses a SAX parser and emits nodes as they are parsed. Only the sort buffer for each parent node's children is held in memory at once.

### Worker Memory Cap

Each worker is capped at `--worker-memory` MB (default: 512MB). If a worker exceeds this while processing a very large component, it falls back to a disk-spill strategy.

### HTML Report Generation

HTML output is generated as a stream and written to disk incrementally. The full set of diff data is never held in memory simultaneously. For large reports (>1000 drifted components), the generator uses a template with lazy-loaded diff sections.

---

## Disk Space

Downloaded org metadata is stored in a temp directory (default: OS temp). Estimate:

- Average component size: 5–20 KB
- 1,000 components: ~5–20 MB
- 10,000 components: ~50–200 MB
- 50,000 components: ~250 MB–1 GB

Use `--temp-dir` to control where this lands, and `--keep-temp` to preserve it for inspection or repeated comparisons without re-downloading.

The temp directory structure mirrors the org's source format:
```
<temp-dir>/
  org-snapshot/
    classes/
    objects/
    flows/
    ...
```

---

## CI/CD Optimisation

### Caching Retrieved Metadata

In CI, cache the retrieved org snapshot between runs to speed up repeated scans:

```yaml
# GitHub Actions example
- name: Cache org snapshot
  uses: actions/cache@v3
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

Use `--include-types` to only scan the types most likely to drift in a given PR context. For example, if a PR only touches Apex, restrict the scan:

```bash
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
| Slow comparison on many large files | `--workers 8` (if CPU permits) |
| Low disk space | `--temp-dir /fast-ssd-path` |
| CI speed optimisation | `--no-progress --parallel-batches 3 --keep-temp` (with caching) |
| Quick targeted scan | `--include-types ApexClass,Flow` |
| Full audit scan | `--no-defaults-exclusion --report-org-only` |
| Memory pressure on huge XML | `--worker-memory 256` (reduce; triggers earlier disk spill) |
