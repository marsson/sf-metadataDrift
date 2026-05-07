# Installation Guide

## Prerequisites

### 1. Salesforce CLI v2

The plugin requires `sf` (Salesforce CLI v2). Verify your installation:

```bash
sf --version
# Expected: @salesforce/cli/2.x.x ...
```

If not installed:
```bash
npm install -g @salesforce/cli
```

### 2. Node.js 18+

```bash
node --version
# Expected: v18.x.x or higher
```

### 3. Authenticated Org

You must have an authenticated connection to the target org:

```bash
# Interactive browser login
sf org login web --alias myOrg

# JWT-based (for CI/CD)
sf org login jwt \
  --client-id <CONNECTED_APP_CLIENT_ID> \
  --jwt-key-file server.key \
  --username ci-user@company.com \
  --alias myOrg
```

---

## Installing the Plugin

### From npm (Production)

```bash
sf plugins install @flightcentre/sf-data-drift
```

Verify:
```bash
sf plugins list | grep data-drift
sf drift --help
```

### From Source (Development)

```bash
# Clone the repository
git clone https://github.com/flightcentre/sf-data-drift.git
cd sf-data-drift

# Install dependencies
npm install

# Link the plugin to your local SF CLI
sf plugins link .

# Verify
sf drift --help
```

### In a CI/CD Pipeline (GitHub Actions example)

```yaml
- name: Install SF CLI
  run: npm install -g @salesforce/cli

- name: Install drift plugin
  run: sf plugins install @flightcentre/sf-data-drift

- name: Authenticate to org
  run: |
    echo "${{ secrets.SF_JWT_KEY }}" > server.key
    sf org login jwt \
      --client-id ${{ secrets.SF_CLIENT_ID }} \
      --jwt-key-file server.key \
      --username ${{ secrets.SF_USERNAME }} \
      --alias targetOrg

- name: Run drift detection
  run: |
    sf drift detect \
      --project-dir . \
      --target-org targetOrg \
      --format json \
      --output drift-report.json

- name: Upload drift report
  uses: actions/upload-artifact@v3
  with:
    name: drift-report
    path: drift-report.json
```

---

## Post-Install Configuration

### Initialize a config file (optional but recommended)

```bash
cd /path/to/your/sfdx-project
sf drift init
```

This creates `.driftrc.json` in your project root with sensible defaults. See [CONFIGURATION.md](./CONFIGURATION.md).

### Verify connectivity

```bash
sf drift detect --target-org myOrg --dry-run
```

The `--dry-run` flag scans your repository and lists what *would* be retrieved without actually calling the org. Useful for verifying scope before a full run.

---

## Updating

```bash
sf plugins update @flightcentre/sf-data-drift
```

---

## Uninstalling

```bash
sf plugins uninstall @flightcentre/sf-data-drift
```

---

## Troubleshooting

### `Error: INSUFFICIENT_ACCESS` during retrieval

The authenticated user needs at least **Modify All Data** or a custom permission set granting access to the metadata types you are scanning. The minimum required permissions for read-only drift scanning are:

- API Enabled
- Modify Metadata Through Metadata API Functions (or Modify All Data)

### Retrieval timeouts on large orgs

Increase the retrieval timeout:
```bash
sf drift detect --target-org myOrg --retrieve-timeout 120000
```

Or reduce batch size to avoid hitting MDAPI limits:
```bash
sf drift detect --target-org myOrg --batch-size 200
```

### Plugin not found after install

```bash
sf plugins install @flightcentre/sf-data-drift --force
sf plugins trust verify --npm @flightcentre/sf-data-drift
```
