import * as path from 'path';
import { METADATA_FILE_SUFFIXES, DECOMPOSED_CHILD_DIRS } from '../../utils/MetadataTypeMap';

export interface ResolvedComponent {
  metadataType: string;
  apiName: string;
  isMetadataFile: boolean;
}

export function resolveFromPath(filePath: string, projectRoot: string): ResolvedComponent | null {
  const basename = path.basename(filePath);
  const relPath = path.relative(projectRoot, filePath);

  // Must end in -meta.xml or be a paired source file (.cls, .trigger, .page, etc.)
  // Try suffix matching first for -meta.xml files
  for (const [suffix, metadataType] of METADATA_FILE_SUFFIXES) {
    if (basename.endsWith(suffix)) {
      const apiName = resolveApiName(filePath, basename, suffix, metadataType);
      if (apiName) {
        return { metadataType, apiName, isMetadataFile: true };
      }
    }
  }

  // Handle paired source files (.cls, .trigger, .page, .component)
  const pairedExtensions: Record<string, string> = {
    '.cls': 'ApexClass',
    '.trigger': 'ApexTrigger',
    '.page': 'ApexPage',
    '.component': 'ApexComponent',
  };

  const ext = path.extname(basename);
  if (pairedExtensions[ext]) {
    // Only include if there's a corresponding -meta.xml (avoid double-registering)
    // We register the .cls file itself since it contains the actual code
    const metadataType = pairedExtensions[ext];
    const apiName = basename.slice(0, -ext.length);
    return { metadataType, apiName, isMetadataFile: false };
  }

  // LWC components: the -meta.xml file is the identifier
  if (relPath.includes(`${path.sep}lwc${path.sep}`) && basename.endsWith('.js-meta.xml')) {
    const componentDir = path.dirname(filePath);
    const apiName = path.basename(componentDir);
    return { metadataType: 'LightningComponentBundle', apiName, isMetadataFile: true };
  }

  // Aura components
  if (relPath.includes(`${path.sep}aura${path.sep}`) && basename.endsWith('.cmp-meta.xml')) {
    const componentDir = path.dirname(filePath);
    const apiName = path.basename(componentDir);
    return { metadataType: 'AuraDefinitionBundle', apiName, isMetadataFile: true };
  }

  return null;
}

function resolveApiName(
  filePath: string,
  basename: string,
  suffix: string,
  metadataType: string
): string | null {
  const nameWithoutSuffix = basename.slice(0, -suffix.length);
  const parentDir = path.basename(path.dirname(filePath));
  const grandParentDir = path.basename(path.dirname(path.dirname(filePath)));
  const greatGrandParentDir = path.basename(path.dirname(path.dirname(path.dirname(filePath))));

  // Decomposed child type inside an object folder
  // e.g. objects/Account/fields/Budget__c.field-meta.xml
  if (DECOMPOSED_CHILD_DIRS.has(parentDir)) {
    const declaredType = DECOMPOSED_CHILD_DIRS.get(parentDir);
    if (declaredType === metadataType) {
      // grandParentDir is the object name, parent of that is "objects"
      // But we need to handle both custom objects and standard objects
      const objectName = grandParentDir;
      return `${objectName}.${nameWithoutSuffix}`;
    }
  }

  // CustomObject root file: objects/Account/Account.object-meta.xml
  if (metadataType === 'CustomObject') {
    // The file is directly inside the object folder
    if (parentDir === nameWithoutSuffix || grandParentDir === 'objects') {
      return nameWithoutSuffix;
    }
    return nameWithoutSuffix;
  }

  // LWC: lwc/componentName/componentName.js-meta.xml
  if (metadataType === 'LightningComponentBundle') {
    return parentDir;
  }

  // Aura: aura/ComponentName/ComponentName.cmp-meta.xml
  if (metadataType === 'AuraDefinitionBundle') {
    return parentDir;
  }

  // Bot versions: bots/BotName/v1.botVersion-meta.xml
  if (metadataType === 'BotVersion') {
    return `${grandParentDir}.${nameWithoutSuffix}`;
  }

  // Territory2 nesting
  if (metadataType === 'Territory2' && greatGrandParentDir === 'territory2Models') {
    return `${grandParentDir}.${nameWithoutSuffix}`;
  }

  // Standard single-file types: just the filename without suffix
  return nameWithoutSuffix;
}

export function isMetadataFile(filePath: string): boolean {
  const basename = path.basename(filePath);
  for (const suffix of METADATA_FILE_SUFFIXES.keys()) {
    if (basename.endsWith(suffix)) return true;
  }
  const ext = path.extname(basename);
  return ['.cls', '.trigger', '.page', '.component'].includes(ext);
}
