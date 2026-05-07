export const DEFAULT_EXCLUDED_TYPES: ReadonlySet<string> = new Set([
  'Profile',
  'PermissionSet',
  'PermissionSetGroup',
  'MutingPermissionSet',
  'CustomPermission',
  'InstalledPackage',
  'Settings',
  'StandardValueSet',
  'StandardValueSetTranslation',
  'AIApplication',
  'AIApplicationConfig',
  'LightningExperienceTheme',
  'Network',
  'NetworkBranding',
]);

export const METADATA_FILE_SUFFIXES: ReadonlyMap<string, string> = new Map([
  ['.cls-meta.xml', 'ApexClass'],
  ['.trigger-meta.xml', 'ApexTrigger'],
  ['.page-meta.xml', 'ApexPage'],
  ['.component-meta.xml', 'ApexComponent'],
  ['.flow-meta.xml', 'Flow'],
  ['.flowDefinition-meta.xml', 'FlowDefinition'],
  ['.object-meta.xml', 'CustomObject'],
  ['.field-meta.xml', 'CustomField'],
  ['.validationRule-meta.xml', 'ValidationRule'],
  ['.listView-meta.xml', 'ListView'],
  ['.recordType-meta.xml', 'RecordType'],
  ['.compactLayout-meta.xml', 'CompactLayout'],
  ['.fieldSet-meta.xml', 'FieldSet'],
  ['.sharingReason-meta.xml', 'SharingReason'],
  ['.index-meta.xml', 'Index'],
  ['.webLink-meta.xml', 'WebLink'],
  ['.businessProcess-meta.xml', 'BusinessProcess'],
  ['.layout-meta.xml', 'Layout'],
  ['.permissionset-meta.xml', 'PermissionSet'],
  ['.profile-meta.xml', 'Profile'],
  ['.labels-meta.xml', 'CustomLabels'],
  ['.label-meta.xml', 'CustomLabel'],
  ['.resource-meta.xml', 'StaticResource'],
  ['.email-meta.xml', 'EmailTemplate'],
  ['.report-meta.xml', 'Report'],
  ['.dashboard-meta.xml', 'Dashboard'],
  ['.md-meta.xml', 'CustomMetadata'],
  ['.tab-meta.xml', 'CustomTab'],
  ['.app-meta.xml', 'CustomApplication'],
  ['.appMenu-meta.xml', 'AppMenu'],
  ['.flexipage-meta.xml', 'FlexiPage'],
  ['.quickAction-meta.xml', 'QuickAction'],
  ['.globalValueSet-meta.xml', 'GlobalValueSet'],
  ['.standardValueSet-meta.xml', 'StandardValueSet'],
  ['.sharingRules-meta.xml', 'SharingRules'],
  ['.workflow-meta.xml', 'Workflow'],
  ['.assignmentRules-meta.xml', 'AssignmentRules'],
  ['.autoResponseRules-meta.xml', 'AutoResponseRules'],
  ['.escalationRules-meta.xml', 'EscalationRules'],
  ['.matchingRules-meta.xml', 'MatchingRules'],
  ['.duplicateRule-meta.xml', 'DuplicateRule'],
  ['.pathAssistant-meta.xml', 'PathAssistant'],
  ['.remoteSite-meta.xml', 'RemoteSiteSetting'],
  ['.namedCredential-meta.xml', 'NamedCredential'],
  ['.connectedApp-meta.xml', 'ConnectedApp'],
  ['.customPermission-meta.xml', 'CustomPermission'],
  ['.bot-meta.xml', 'Bot'],
  ['.botVersion-meta.xml', 'BotVersion'],
  ['.lwc-meta.xml', 'LightningComponentBundle'],
  ['.aura-meta.xml', 'AuraDefinitionBundle'],
  ['.cmp-meta.xml', 'AuraDefinitionBundle'],
  ['.permissionsetgroup-meta.xml', 'PermissionSetGroup'],
  ['.mutingpermissionset-meta.xml', 'MutingPermissionSet'],
  ['.reportType-meta.xml', 'ReportType'],
  ['.territory2Model-meta.xml', 'Territory2Model'],
  ['.territory2-meta.xml', 'Territory2'],
  ['.territory2Rule-meta.xml', 'Territory2Rule'],
  ['.contentasset-meta.xml', 'ContentAsset'],
  ['.certificate-meta.xml', 'Certificate'],
  ['.role-meta.xml', 'Role'],
  ['.group-meta.xml', 'Group'],
  ['.queue-meta.xml', 'Queue'],
  ['.translation-meta.xml', 'Translations'],
  ['.globalValueSetTranslation-meta.xml', 'GlobalValueSetTranslation'],
  ['.customMetadata-meta.xml', 'CustomMetadata'],
  ['.site-meta.xml', 'CustomSite'],
  ['.network-meta.xml', 'Network'],
  ['.brandingSet-meta.xml', 'BrandingSet'],
  ['.settings-meta.xml', 'Settings'],
]);

export const DECOMPOSED_CHILD_DIRS: ReadonlyMap<string, string> = new Map([
  ['fields', 'CustomField'],
  ['validationRules', 'ValidationRule'],
  ['listViews', 'ListView'],
  ['recordTypes', 'RecordType'],
  ['compactLayouts', 'CompactLayout'],
  ['fieldSets', 'FieldSet'],
  ['sharingReasons', 'SharingReason'],
  ['indexes', 'Index'],
  ['webLinks', 'WebLink'],
  ['businessProcesses', 'BusinessProcess'],
]);

export const NON_META_XML_EXTENSIONS: ReadonlySet<string> = new Set([
  '.cls',
  '.trigger',
  '.page',
  '.component',
  '.html',
  '.js',
  '.css',
  '.svg',
  '.xml',
  '.email',
  '.resource',
  '.cmp',
  '.evt',
  '.intf',
  '.app',
  '.design',
  '.auradoc',
  '.tokens',
  '.apex',
]);

export function resolveExcludedTypes(
  useDefaults: boolean,
  additionalTypes: string[],
  includeOverride: string[]
): Set<string> {
  const excluded = new Set<string>();

  if (useDefaults) {
    for (const t of DEFAULT_EXCLUDED_TYPES) {
      excluded.add(t);
    }
  }

  for (const t of additionalTypes) {
    excluded.add(t);
  }

  for (const t of includeOverride) {
    excluded.delete(t);
  }

  return excluded;
}
