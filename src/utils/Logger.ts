import chalk from 'chalk';

export class DriftLogger {
  private static instances = new Map<string, DriftLogger>();
  private isVerbose: boolean;

  private constructor(private readonly name: string, isVerbose = false) {
    this.isVerbose = isVerbose;
  }

  static get(name: string, isVerbose = false): DriftLogger {
    const key = `${name}:${isVerbose}`;
    if (!DriftLogger.instances.has(key)) {
      DriftLogger.instances.set(key, new DriftLogger(name, isVerbose));
    }
    return DriftLogger.instances.get(key)!;
  }

  static create(isVerbose = false): DriftLogger {
    return new DriftLogger('drift', isVerbose);
  }

  log(msg: string): void {
    process.stdout.write(msg + '\n');
  }

  info(msg: string): void {
    process.stdout.write(`  ${chalk.blue('ℹ')} ${msg}\n`);
  }

  success(msg: string): void {
    process.stdout.write(`  ${chalk.green('✔')} ${msg}\n`);
  }

  warn(msg: string): void {
    process.stderr.write(`  ${chalk.yellow('⚠')} ${chalk.yellow(msg)}\n`);
  }

  error(msg: string): void {
    process.stderr.write(`  ${chalk.red('✖')} ${chalk.red(msg)}\n`);
  }

  verbose(msg: string): void {
    if (this.isVerbose) {
      process.stdout.write(`  ${chalk.gray('·')} ${chalk.gray(msg)}\n`);
    }
  }

  stage(title: string): void {
    const line = '─'.repeat(48);
    process.stdout.write(`\n${chalk.cyan.bold(`── ${title} ${line.slice(title.length + 4)}`)}\n`);
  }

  blank(): void {
    process.stdout.write('\n');
  }

  section(title: string, value: string): void {
    process.stdout.write(`  ${chalk.dim(title + ':')} ${value}\n`);
  }
}
