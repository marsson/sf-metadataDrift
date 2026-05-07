# Exclusion Reference

## Why Exclude Metadata Types?

Certain Salesforce metadata types are inherently **environment-dependent** or **aggregate many other components' state**. Comparing them directly produces noisy, misleading results:

- **Profiles** contain permissions for every object, field, class, and page in the org. A single new object deployment changes the profile. Comparing profiles creates hundreds of false drift signals.
- **Permission Sets** have the same problem.
- **Installed Package metadata** reflects the current package version in the org — managing this as first-party drift is incorrect.
- **Settings** differ between sandbox and production and are not routinely deployed as source.

The default exclusion list deliberately omits these types to give clean, actionable drift results focused on **custom and configuration metadata you own**.

---

## Default Exclusion List

These types are excluded by default. Use `--no-defaults-exclusion` to disable all defaults, or `exclusions.includeOverride` in `.driftrc.json` to selectively re-include individual types.

### Permissions & Access Control

| Type | API Name | Reason |
|---|---|---|
| Profile | `Profile` | Aggregate of all permissions; org-environment-specific |
| Permission Set | `PermissionSet` | Same as Profile; user-assignment-driven |
| Permission Set Group | `PermissionSetGroup` | Composition of Permission Sets |
| Muting Permission Set | `MutingPermissionSet` | Org-specific permission overrides |
| Custom Permission | `CustomPermission` | Usually stable; excluded due to Profile dependency |

### Installed Packages

| Type | API Name | Reason |
|---|---|---|
| Installed Package | `InstalledPackage` | Tracks managed package versions; org-specific |

### Org-Configuration Types

| Type | API Name | Reason |
|---|---|---|
| Settings | `Settings` | Org-feature flags; vary between sandbox and production |

### System-Generated / Volatile Types

| Type | API Name | Reason |
|---|---|---|
| Standard Value Set | `StandardValueSet` | Salesforce-managed; not deployable as custom |
| Standard Value Set Translation | `StandardValueSetTranslation` | Same |
| AI Application | `AIApplication` | Org-specific ML models |
| AI Application Config | `AIApplicationConfig` | Org-specific ML models |
| Lightning Experience Theme | `LightningExperienceTheme` | Org branding; not code |
| Network | `Network` | Experience Cloud; highly org-specific |
| Network Branding | `NetworkBranding` | Experience Cloud; highly org-specific |

---

## Configuring Exclusions

### Exclude Additional Types

Via CLI flag:
```bash
sf drift detect -o myOrg --exclude-types Flow,FlowDefinition,ReportType
```

Via `.driftrc.json`:
```json
{
  "exclusions": {
    "useDefaults": true,
    "additionalTypes": ["Flow", "FlowDefinition", "ReportType"]
  }
}
```

### Re-include a Defaulted-Out Type

To include `Profile` while keeping all other defaults:
```json
{
  "exclusions": {
    "useDefaults": true,
    "includeOverride": ["Profile"]
  }
}
```

Via CLI — `--no-defaults-exclusion` removes **all** defaults, so specify everything you want to include:
```bash
sf drift detect -o myOrg --no-defaults-exclusion --include-types Profile
```

### Disable All Exclusions

```bash
sf drift detect -o myOrg --no-defaults-exclusion
```

This scans every metadata type found in the repository including profiles and permission sets.

---

## Recommended Exclusion Patterns by Use Case

### Standard Development Workflow

Use defaults. The excluded types are not managed through normal deployments.

### Release Audit

```json
{
  "exclusions": {
    "useDefaults": true,
    "additionalTypes": ["Report", "Dashboard"]
  }
}
```

Reports and dashboards are often modified in production without being committed — exclude them for a focused audit.

### Compliance / Security Audit

```bash
sf drift detect -o myOrg --no-defaults-exclusion --include-types Profile,PermissionSet,PermissionSetGroup
```

When auditing who has access to what, profiles and permission sets are exactly what you want to compare.

### CI Pipeline (Pre-Deploy Gate)

```json
{
  "exclusions": {
    "useDefaults": true,
    "additionalTypes": ["Report", "Dashboard", "Flow", "FlowDefinition"]
  }
}
```

Exclude types that are commonly changed outside of version control by business users (Flows, Reports) to keep CI gates focused on code-quality drift.
