import * as path from 'path';
import * as fs from 'fs';
import { normaliseXml } from './XmlNormaliser';
import { computeDiff } from './TextDiff';
import type { ComponentEntry } from '../../types/ComponentTypes';
import type { DriftResult } from '../../types/DriftReport';
import type { ComparisonConfig } from '../../types/Config';

const XML_EXTENSIONS = new Set(['.xml']);
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg',
  '.woff', '.woff2', '.ttf', '.eot',
  '.zip', '.jar', '.pdf',
]);

export async function compareComponent(
  entry: ComponentEntry,
  orgFilePaths: string[],
  config: ComparisonConfig
): Promise<DriftResult> {
  // DELETED: in repo, not in org
  if (orgFilePaths.length === 0) {
    return {
      manifestKey: entry.manifestKey,
      metadataType: entry.metadataType,
      apiName: entry.apiName,
      status: 'DELETED',
      repoFilePaths: entry.filePaths,
      orgFilePaths: [],
      linesAdded: 0,
      linesRemoved: 0,
      hunks: [],
    };
  }

  let totalAdded = 0;
  let totalRemoved = 0;
  const allHunks: DriftResult['hunks'] = [];
  let hasChanges = false;

  // Compare each repo file against its corresponding org file
  for (const repoFilePath of entry.filePaths) {
    const filename = path.basename(repoFilePath);
    const ext = path.extname(filename).toLowerCase();

    // Skip binary files
    if (BINARY_EXTENSIONS.has(ext)) continue;

    // Find matching org file by filename
    const orgFilePath = findMatchingOrgFile(filename, orgFilePaths);
    if (!orgFilePath) {
      // File exists in repo but not in org output — treat as changed
      hasChanges = true;
      continue;
    }

    let repoContent: string;
    let orgContent: string;

    try {
      repoContent = await fs.promises.readFile(repoFilePath, 'utf8');
      orgContent = await fs.promises.readFile(orgFilePath, 'utf8');
    } catch {
      // Unreadable file — skip
      continue;
    }

    // Normalise XML before diffing to eliminate node-order false positives
    if (XML_EXTENSIONS.has(ext) && config.xmlNormalization) {
      repoContent = normaliseXml(repoContent);
      orgContent = normaliseXml(orgContent);
    }

    // Strip comments if configured
    if (config.ignoreComments && XML_EXTENSIONS.has(ext)) {
      repoContent = stripXmlComments(repoContent);
      orgContent = stripXmlComments(orgContent);
    }

    // Normalise whitespace if configured
    if (config.ignoreWhitespace) {
      repoContent = normaliseWhitespace(repoContent);
      orgContent = normaliseWhitespace(orgContent);
    }

    const diff = computeDiff(repoContent, orgContent, filename, config.contextLines);

    if (!diff.identical) {
      // Skip if the only differences are whitespace characters (spaces, tabs, line breaks)
      if (config.ignoreWhitespace && isWhitespaceOnlyDiff(repoContent, orgContent)) {
        continue;
      }
      hasChanges = true;
      totalAdded += diff.linesAdded;
      totalRemoved += diff.linesRemoved;
      allHunks.push(...diff.hunks);
    }
  }

  return {
    manifestKey: entry.manifestKey,
    metadataType: entry.metadataType,
    apiName: entry.apiName,
    status: hasChanges ? 'CHANGED' : 'UNCHANGED',
    repoFilePaths: entry.filePaths,
    orgFilePaths,
    linesAdded: totalAdded,
    linesRemoved: totalRemoved,
    hunks: allHunks,
  };
}

function findMatchingOrgFile(filename: string, orgFilePaths: string[]): string | null {
  // Exact filename match
  for (const orgPath of orgFilePaths) {
    if (path.basename(orgPath) === filename) return orgPath;
  }
  // Case-insensitive fallback
  const lc = filename.toLowerCase();
  for (const orgPath of orgFilePaths) {
    if (path.basename(orgPath).toLowerCase() === lc) return orgPath;
  }
  return null;
}

function stripXmlComments(xml: string): string {
  return xml.replace(/<!--[\s\S]*?-->/g, '');
}

function normaliseWhitespace(content: string): string {
  return content
    .replace(/\r\n/g, '\n')   // normalise line endings first
    .split('\n')
    .map(line => line.trimEnd())   // strip trailing spaces/tabs
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');  // collapse runs of blank lines
}

// Returns true when the two strings differ only in whitespace characters
// (spaces, tabs, carriage returns, line feeds). Meaningful content is identical.
function isWhitespaceOnlyDiff(a: string, b: string): boolean {
  return a.replace(/\s+/g, '') === b.replace(/\s+/g, '');
}
