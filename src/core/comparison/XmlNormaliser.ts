import { XMLParser, XMLBuilder } from 'fast-xml-parser';

const CANONICAL_KEYS = ['fullName', 'name', 'label', 'apiName', 'developerName'];

export function normaliseXml(xmlString: string): string {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: false,
    trimValues: true,
    cdataPropName: '__cdata',
    commentPropName: '__comment',
    ignoreDeclaration: false,
    parseTagValue: false,
    allowBooleanAttributes: true,
  });

  let parsed: unknown;
  try {
    parsed = parser.parse(xmlString);
  } catch {
    // If XML parsing fails, return as-is for raw text diff
    return xmlString;
  }

  sortNode(parsed);

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    format: true,
    indentBy: '    ',
    cdataPropName: '__cdata',
    commentPropName: '__comment',
    suppressEmptyNode: true,
    suppressBooleanAttributes: false,
  });

  try {
    return builder.build(parsed);
  } catch {
    return xmlString;
  }
}

function sortNode(node: unknown): void {
  if (node === null || node === undefined) return;

  if (Array.isArray(node)) {
    // Sort array elements by canonical key
    node.sort((a, b) => {
      const ka = getCanonicalKey(a);
      const kb = getCanonicalKey(b);
      return ka.localeCompare(kb, undefined, { sensitivity: 'base' });
    });
    for (const item of node) {
      sortNode(item);
    }
    return;
  }

  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    // Sort keys for a canonical property order (eliminates false positives from element reordering)
    const sortedKeys = Object.keys(obj).sort();
    for (const key of sortedKeys) {
      const val = obj[key];
      delete obj[key];
      obj[key] = val;
    }
    for (const key of Object.keys(obj)) {
      if (key === '__cdata' || key === '__comment') continue;
      sortNode(obj[key]);
    }
  }
}

function getCanonicalKey(element: unknown): string {
  if (element === null || element === undefined) return '';
  if (typeof element !== 'object') return String(element);

  const e = element as Record<string, unknown>;
  for (const key of CANONICAL_KEYS) {
    if (e[key] !== undefined && e[key] !== null) {
      return String(e[key]);
    }
  }

  // Fallback: stable string representation
  try {
    return JSON.stringify(element);
  } catch {
    return '';
  }
}
