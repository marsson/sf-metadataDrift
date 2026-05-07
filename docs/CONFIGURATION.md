# Configuration Guide

## Configuration File: `.driftrc.json`

Place `.driftrc.json` in your SFDX project root (same directory as `sfdx-project.json`). Settings in the file are merged with and overridden by CLI flags.

Run `sf drift init` to generate a pre-filled config file.

### Full Example

```json
{
  "$schema": "https://raw.githubusercontent.com/marsson/sf-metadata-drift/main/schema/driftrc.schema.json",
  "targetOrg": "production",
  "defaultFormat": "html",
  "defaultOutput": "./reports/drift-latest.html",
  "batchSize": 400,
  "retrieveTimeout": 90000,
  "parallelBatches": 1,
  "workers": 4,
  "apiVersion": "59.0",
  "reportOrgOnly": false,
  "exclusions": {
    "useDefaults": true,
    "additionalTypes": ["CustomPermission", "ConnectedApp"],
    "includeOverride": []
  },
  "ignorePatterns": [
    "**/*.md",
    "**/README*",
    "force-app/main/default/staticresources/LegacyFiles/**"
  ],
  "comparison": {
    "xmlNormalization": true,
    "ignoreWhitespace": true,
    "ignoreComments": true,
    "contextLines": 5
  },
  "htmlReport": {
    "title": "Salesforce Drift Report",
    "theme": "light",
    "includeUnchanged": false,
    "syntaxHighlight": true
  },
  "tempDir": "./.drift-cache",
  "keepTemp": false,
  "verbose": false
}
```

---

## Options Reference

### Root Options

| Key | Type | Default | Description |
|---|---|---|---|
| `targetOrg` | `string` | — | Default org alias. Overridden by `-o` flag |
| `defaultFormat` | `"table"\|"json"\|"html"` | `"table"` | Default output format |
| `defaultOutput` | `string` | — | Default output file path |
| `batchSize` | `number` | `500` | Components per MDAPI retrieve batch |
| `retrieveTimeout` | `number` | `60000` | Per-batch timeout in milliseconds |
| `parallelBatches` | `number` | `1` | Concurrent retrieval batches (max 5) |
| `workers` | `number` | `CPUs - 1` | Concurrent comparison tasks |
| `apiVersion` | `string` | org max | Salesforce API version |
| `reportOrgOnly` | `boolean` | `false` | Report components in org but not in repo |
| `tempDir` | `string` | OS temp | Directory for downloaded org metadata |
| `keepTemp` | `boolean` | `false` | Keep downloaded metadata after the run |
| `verbose` | `boolean` | `false` | Enable verbose logging |

---

### `exclusions` Object

Controls which metadata types are excluded from comparison.

| Key | Type | Default | Description |
|---|---|---|---|
| `useDefaults` | `boolean` | `true` | Apply built-in exclusion list |
| `additionalTypes` | `string[]` | `[]` | Extra types to exclude on top of defaults |
| `includeOverride` | `string[]` | `[]` | Re-include types from the default exclusion list |

**Example: include profiles but keep everything else excluded by default**
```json
{
  "exclusions": {
    "useDefaults": true,
    "includeOverride": ["Profile"]
  }
}
```

See [EXCLUSIONS.md](./EXCLUSIONS.md) for the full default exclusion list.

---

### `ignorePatterns` Array

Glob patterns (relative to project root) for files to exclude from comparison. Uses `micromatch` syntax.

```json
{
  "ignorePatterns": [
    "force-app/main/default/staticresources/vendor/**",
    "**/__tests__/**",
    "**/*.snap"
  ]
}
```

---

### `comparison` Object

Controls how files are compared.

| Key | Type | Default | Description |
|---|---|---|---|
| `xmlNormalization` | `boolean` | `true` | Sort XML child nodes before comparing |
| `ignoreWhitespace` | `boolean` | `true` | Treat whitespace-only differences as non-drifted |
| `ignoreComments` | `boolean` | `true` | Ignore XML comment differences |
| `contextLines` | `number` | `5` | Lines of context around each diff hunk |

#### XML Normalization Detail

When `xmlNormalization` is `true`, the engine:
1. Parses both XML files (repo and org) into an AST
2. Sorts object keys alphabetically for a canonical property order
3. For arrays of sibling elements: sorts by `fullName`, `name`, `label`, or `apiName`
4. Serialises back to canonical XML
5. Runs text diff on the normalised output

This prevents false positives where Salesforce retrieves nodes in a different order than the deployed order.

#### Whitespace Handling

When `ignoreWhitespace` is `true`, the engine:
1. Normalises line endings (`\r\n` → `\n`)
2. Strips trailing whitespace from each line
3. Collapses runs of three or more blank lines to two
4. If the only remaining differences are whitespace characters, the component is treated as unchanged

---

### `htmlReport` Object

Controls the HTML output format.

| Key | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | `"Salesforce Drift Report"` | Report page title |
| `theme` | `"light"\|"dark"` | `"light"` | Colour theme |
| `includeUnchanged` | `boolean` | `false` | Include unchanged components in the table |
| `syntaxHighlight` | `boolean` | `true` | Syntax-highlight diff content |

---

## Settings Priority

Settings are resolved in this order (highest priority first):

```
CLI flags  →  SF_DRIFT_* environment variables  →  .driftrc.json  →  built-in defaults
```

---

## Schema Validation

Add the `$schema` key to get IDE autocompletion and validation in VS Code:

```json
{
  "$schema": "https://raw.githubusercontent.com/marsson/sf-metadata-drift/main/schema/driftrc.schema.json"
}
```

---

## `.driftignore` File

As an alternative to `ignorePatterns` in the JSON config, you can create a `.driftignore` file (same syntax as `.gitignore`) in the project root:

```gitignore
# Ignore legacy static resources
force-app/main/default/staticresources/LegacyFiles/

# Ignore generated files
**/*.generated.xml

# Ignore a specific component
force-app/main/default/classes/GeneratedScheduler.cls
force-app/main/default/classes/GeneratedScheduler.cls-meta.xml
```
