#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { runScan } from '../src/scanner.js';
import { reportToConsole } from '../src/reporter.js';
import { ScanOptions } from '../src/types.js';

const program = new Command();

// Setup CLI defaults, options, and help metadata
program
  .name('ghostdep')
  .description('Audit Node.js/TypeScript projects for ghost, zombie, duplicate, and drifted dependencies.')
  .version('0.1.0')
  .option('-d, --cwd <path>', 'Working directory of the target project', process.cwd())
  .option('--include-dev', 'Include devDependencies in analysis checks', false)
  .option('--include <patterns>', 'Comma-separated glob patterns of source files to include')
  .option('--exclude <patterns>', 'Comma-separated glob patterns of source files to ignore');

/**
 * Utility helper to parse comma-separated CLI inputs into string arrays.
 */
function parseList(value?: string): string[] | undefined {
  return value ? value.split(',').map((item) => item.trim()) : undefined;
}

/**
 * Common execution runner that triggers the scanner and formats the report.
 */
async function executeScan(format: 'pretty' | 'json' | 'health') {
  const options = program.opts();

  try {
    const scanOptions: Partial<ScanOptions> = {
      cwd: (options['cwd'] as string) || process.cwd(),
      includeDev: !!options['includeDev'],
    };

    const includeList = parseList(options['include'] as string);
    if (includeList) {
      scanOptions.include = includeList;
    }

    const excludeList = parseList(options['exclude'] as string);
    if (excludeList) {
      scanOptions.exclude = excludeList;
    }

    // Import the type ScanOptions inside bin/cli.ts
    const report = await runScan(scanOptions);

    if (format === 'json') {
      console.log(JSON.stringify(report, null, 2));
    } else if (format === 'health') {
      const score = report.health.score;
      const grade = report.health.grade;

      const gradeColor =
        grade === 'A' || grade === 'B'
          ? chalk.bold.green
          : grade === 'C' || grade === 'D'
            ? chalk.bold.yellow
            : chalk.bold.red;

      const scoreColor =
        score >= 90
          ? chalk.bold.green
          : score >= 75
            ? chalk.bold.cyan
            : score >= 60
              ? chalk.bold.yellow
              : chalk.bold.red;

      console.log(`Health Score: ${scoreColor(score)}/100 (${gradeColor(grade)})`);
    } else {
      reportToConsole(report);
    }

    // Set non-zero exit code if critical issue (ghost dependencies) is discovered
    if (report.ghosts.length > 0) {
      process.exitCode = 1;
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error(chalk.red.bold(`\nError: ${err.message}`));
    process.exit(1);
  }
}

// 1. Default action (when no subcommand is passed)
program.action(async () => {
  await executeScan('pretty');
});

// 2. "scan" subcommand (same behavior as default, but explicit)
program
  .command('scan')
  .description('Scan project dependencies and print a detailed console report (default action)')
  .action(async () => {
    await executeScan('pretty');
  });

// 3. "json" subcommand (outputs raw JSON report for CI/pipeline consumption)
program
  .command('json')
  .description('Scan project dependencies and output a raw JSON report')
  .action(async () => {
    await executeScan('json');
  });

// 4. "health" subcommand (outputs only the score summary)
program
  .command('health')
  .description('Scan project dependencies and print only the health score & grade summary')
  .action(async () => {
    await executeScan('health');
  });

// Run parser
program.parse(process.argv);
