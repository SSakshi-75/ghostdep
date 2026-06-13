import chalk from 'chalk';
import { ScanReport } from './types.js';

/**
 * Outputs a beautifully formatted CLI report summarizing the dependency audit scan results,
 * color-coded by issue severity using chalk.
 *
 * @param report The final ScanReport resulting from the scan
 */
export function reportToConsole(report: ScanReport): void {
  const { project, durationMs, ghosts, zombies, duplicates, drifts, health } = report;

  // Header Banner
  console.log('\n' + chalk.bold.cyan('👻 ghostdep') + chalk.dim(` v0.1.0`));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(`${chalk.bold('Target Project:')}  ${chalk.white(project.name)}`);
  console.log(`${chalk.bold('Version:')}         ${chalk.white(project.version)}`);
  console.log(`${chalk.bold('Scan Time:')}       ${chalk.white(durationMs)}ms`);
  console.log(chalk.gray('─'.repeat(60)) + '\n');

  // 1. Ghost Dependencies (Highest Priority - Missing Declarations)
  if (ghosts.length > 0) {
    console.log(chalk.bold.red(`👻 Ghost Dependencies (${ghosts.length})`));
    console.log(chalk.dim('   Packages imported in code but not declared in package.json'));
    console.log(chalk.gray('   ' + '─'.repeat(54)));
    for (const ghost of ghosts) {
      console.log(`   ${chalk.red('✗')} ${chalk.bold.white(ghost.name)}`);

      const filesLimit = 5;
      const formattedFiles = ghost.files
        .slice(0, filesLimit)
        .map((f) => chalk.gray(f))
        .join(', ');
      const overflow = ghost.files.length > filesLimit ? chalk.dim(` (+${ghost.files.length - filesLimit} more)`) : '';
      console.log(`     ${chalk.dim('Files:')}    ${formattedFiles}${overflow}`);
      console.log(`     ${chalk.dim('Imports:')}  ${chalk.gray(ghost.specifiers.join(', '))}`);
    }
    console.log();
  }

  // 2. Zombie Dependencies (Unused Declarations)
  if (zombies.length > 0) {
    console.log(chalk.bold.yellow(`🧟 Zombie Dependencies (${zombies.length})`));
    console.log(chalk.dim('   Declared in package.json but never imported or required in code'));
    console.log(chalk.gray('   ' + '─'.repeat(54)));
    for (const zombie of zombies) {
      console.log(
        `   ${chalk.yellow('⚠')} ${chalk.bold.white(zombie.name)} ${chalk.dim(`(${zombie.declaredVersion})`)} [${chalk.cyan(zombie.type)}]`
      );
    }
    console.log();
  }

  // 3. Duplicate Dependency Versions
  if (duplicates.length > 0) {
    console.log(chalk.bold.magenta(`📦 Duplicate Package Versions (${duplicates.length})`));
    console.log(chalk.dim('   Multiple conflicting versions of the same package resolved in node_modules'));
    console.log(chalk.gray('   ' + '─'.repeat(54)));
    for (const dup of duplicates) {
      console.log(`   ${chalk.magenta('⇄')} ${chalk.bold.white(dup.name)}`);
      for (const instance of dup.versions) {
        console.log(`     ${chalk.bold.white(instance.version)} resolved at:`);
        for (const path of instance.paths) {
          console.log(`       ${chalk.gray(path)}`);
        }
      }
    }
    console.log();
  }

  // 4. Version Drifts
  if (drifts.length > 0) {
    console.log(chalk.bold.blue(`🔄 Version Drift Mismatches (${drifts.length})`));
    console.log(chalk.dim('   Difference between declared semver ranges and actual installed versions'));
    console.log(chalk.gray('   ' + '─'.repeat(54)));
    for (const drift of drifts) {
      const typeColor =
        drift.driftType === 'major' || drift.driftType === 'missing'
          ? chalk.red
          : drift.driftType === 'minor'
            ? chalk.yellow
            : chalk.green;

      const installedStr = drift.installedVersion
        ? chalk.white(drift.installedVersion)
        : chalk.red.bold('NOT INSTALLED');

      console.log(`   ${chalk.blue('ℹ')} ${chalk.bold.white(drift.name)} [${chalk.cyan(drift.dependencyType)}]`);
      console.log(`     Declared Range:    ${chalk.gray(drift.declaredVersion)}`);
      console.log(`     Installed Version: ${installedStr}`);
      console.log(`     Drift Category:    ${typeColor(drift.driftType.toUpperCase())}`);
    }
    console.log();
  }

  // 5. Overall Health Report Card
  console.log(chalk.gray('─'.repeat(60)));

  const gradeColor =
    health.grade === 'A'
      ? chalk.bold.green
      : health.grade === 'B'
        ? chalk.bold.green
        : health.grade === 'C'
          ? chalk.bold.yellow
          : health.grade === 'D'
            ? chalk.bold.yellow
            : chalk.bold.red;

  const scoreColor =
    health.score >= 90
      ? chalk.bold.green
      : health.score >= 75
        ? chalk.bold.cyan
        : health.score >= 60
          ? chalk.bold.yellow
          : chalk.bold.red;

  console.log(chalk.bold('📊 HEALTH REPORT CARD'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(`Overall Health Score:  ${scoreColor(health.score)} / 100`);
  console.log(`Letter Grade Summary:  ${gradeColor(health.grade)}`);

  if (health.deductions.length > 0) {
    console.log(`\n${chalk.bold('Deductions Details:')}`);
    for (const deduction of health.deductions) {
      console.log(`  ${chalk.red('•')} ${deduction.reason}: ${chalk.red(`-${deduction.penalty} pts`)}`);
    }
  } else {
    console.log(`\n${chalk.bold.green('✨ Clean Audit! All dependencies are fully optimized and healthy.')}`);
  }
  console.log(chalk.gray('─'.repeat(60)) + '\n');
}
