import * as path from 'path';
import micromatch from 'micromatch';
import { walkDir } from '../../utils/FileUtils';
import { resolveFromPath } from './MetadataTypeResolver';
import { ComponentRegistry } from './ComponentRegistry';
import { resolveExcludedTypes } from '../../utils/MetadataTypeMap';
import { DriftLogger } from '../../utils/Logger';
import type { ScanConfig } from '../../types/Config';

export class RepositoryScanner {
  async scan(packageDirs: string[], config: ScanConfig): Promise<ComponentRegistry> {
    const logger = DriftLogger.create(config.verbose);
    const registry = new ComponentRegistry();
    const excludedTypes = resolveExcludedTypes(
      config.exclusions.useDefaults,
      config.exclusions.additionalTypes,
      config.exclusions.includeOverride
    );

    let scanned = 0;
    let skipped = 0;

    for (const packageDir of packageDirs) {
      logger.verbose(`Scanning directory: ${packageDir}`);

      for await (const filePath of walkDir(packageDir)) {
        const relPath = path.relative(config.projectDir, filePath);

        // Apply ignore patterns
        if (config.ignorePatterns.length > 0 && micromatch.isMatch(relPath, config.ignorePatterns)) {
          skipped++;
          continue;
        }

        const resolved = resolveFromPath(filePath, config.projectDir);
        if (!resolved) continue;

        // Apply type filters
        if (excludedTypes.has(resolved.metadataType)) {
          skipped++;
          continue;
        }

        if (config.includeTypes !== null && !config.includeTypes.includes(resolved.metadataType)) {
          skipped++;
          continue;
        }

        const manifestKey = `${resolved.metadataType}:${resolved.apiName}`;

        registry.add({
          metadataType: resolved.metadataType,
          apiName: resolved.apiName,
          filePaths: [filePath],
          relativeFilePaths: [relPath],
          manifestKey,
        });

        scanned++;
      }
    }

    logger.verbose(`Scanned ${scanned} files, skipped ${skipped}`);
    return registry;
  }
}
