import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import chalk from 'chalk';
import { formatBytes } from '../../utils/FileUtils';

export default class DriftClean extends SfCommand<void> {
  public static readonly summary = 'Remove cached org metadata snapshots left by --keep-temp.';

  public static readonly examples = [
    '$ sf drift clean --temp-dir ./.drift-cache',
    '$ sf drift clean --all',
  ];

  public static readonly flags = {
    'temp-dir': Flags.directory({
      summary: 'Path to the specific temp/cache directory to remove.',
    }),
    all: Flags.boolean({
      summary: 'Remove all sf-metadata-drift-* directories from the OS temp folder.',
      default: false,
    }),
    force: Flags.boolean({
      summary: 'Skip confirmation prompt.',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(DriftClean);

    const dirsToRemove: string[] = [];

    if (flags['temp-dir']) {
      const target = path.resolve(flags['temp-dir'] as string);
      if (fs.existsSync(target)) {
        dirsToRemove.push(target);
      } else {
        process.stdout.write(chalk.yellow(`  Directory not found: ${target}\n`));
        return;
      }
    } else if (flags.all) {
      const tmpDir = os.tmpdir();
      const entries = fs.readdirSync(tmpDir);
      for (const entry of entries) {
        if (entry.startsWith('sf-metadata-drift-')) {
          dirsToRemove.push(path.join(tmpDir, entry));
        }
      }
    } else {
      process.stdout.write(
        chalk.yellow('  Specify --temp-dir <path> or --all to remove drift cache directories.\n')
      );
      return;
    }

    if (dirsToRemove.length === 0) {
      process.stdout.write(chalk.green('  ✔ No drift cache directories found.\n'));
      return;
    }

    // Calculate total size
    let totalSize = 0;
    for (const dir of dirsToRemove) {
      try {
        const stat = fs.statSync(dir);
        if (stat.isDirectory()) {
          totalSize += await this.dirSize(dir);
        }
      } catch {
        // ignore
      }
    }

    process.stdout.write(
      `  Found ${chalk.bold(String(dirsToRemove.length))} director${dirsToRemove.length === 1 ? 'y' : 'ies'} ` +
      `(${formatBytes(totalSize)}):\n`
    );
    for (const dir of dirsToRemove) {
      process.stdout.write(`  ${chalk.dim('·')} ${dir}\n`);
    }

    if (!flags.force) {
      // In non-interactive environments, default to not removing
      if (!process.stdin.isTTY) {
        process.stdout.write(chalk.yellow('  Non-interactive mode. Use --force to remove.\n'));
        return;
      }

      process.stdout.write(chalk.yellow('\n  Remove these directories? [y/N] '));
      const answer = await this.readLine();
      if (!answer.toLowerCase().startsWith('y')) {
        process.stdout.write(chalk.dim('  Cancelled.\n'));
        return;
      }
    }

    for (const dir of dirsToRemove) {
      try {
        await fs.promises.rm(dir, { recursive: true, force: true });
        process.stdout.write(`  ${chalk.green('✔')} Removed ${dir}\n`);
      } catch (err) {
        process.stdout.write(`  ${chalk.red('✖')} Failed to remove ${dir}: ${(err as Error).message}\n`);
      }
    }
  }

  private readLine(): Promise<string> {
    return new Promise(resolve => {
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.once('data', chunk => {
        data += chunk;
        resolve(data.trim());
      });
    });
  }

  private async dirSize(dirPath: string): Promise<number> {
    let size = 0;
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          size += await this.dirSize(full);
        } else {
          const stat = await fs.promises.stat(full);
          size += stat.size;
        }
      }
    } catch {
      // ignore
    }
    return size;
  }
}
