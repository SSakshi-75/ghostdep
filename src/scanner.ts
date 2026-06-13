import { readPackageJson, scanFiles } from './utils/fs.js';
import { detectGhosts } from './detectors/ghosts.js';
import { detectZombies } from './detectors/zombies.js';
import { detectDuplicates } from './detectors/duplicates.js';
import { detectDrifts } from './detectors/drift.js';
import { calculateHealthScore } from './health.js';
import { ScanReport, ScanOptions } from './types.js';

/**
 * Executes a full dependency audit scan of the target project directory.
 *
 * Runs all detectors (ghosts, zombies, duplicates, drifts) concurrently,
 * computes the overall project health score, and generates a structured report.
 *
 * @param partialOptions Configuration overrides for the scanning process
 * @returns Fully populated ScanReport
 */
export async function runScan(partialOptions: Partial<ScanOptions> = {}): Promise<ScanReport> {
  const startTime = Date.now();

  // 1. Resolve configuration options with defaults
  const options: ScanOptions = {
    cwd: partialOptions.cwd || process.cwd(),
    include: partialOptions.include || ['**/*.{js,jsx,ts,tsx,mjs,cjs}'],
    exclude: partialOptions.exclude || [],
    includeDev: partialOptions.includeDev ?? false,
    ...(partialOptions.penalties ? { penalties: partialOptions.penalties } : {}),
  };

  try {
    // 2. Read package.json metadata
    const packageJson = await readPackageJson(options.cwd);

    // 3. Scan the codebase directory for source files
    const sourceFiles = await scanFiles(options.cwd, options.include, options.exclude);

    // 4. Run diagnostics concurrently for optimal performance
    const [ghosts, zombies, duplicates, drifts] = await Promise.all([
      detectGhosts(options.cwd, sourceFiles, packageJson, options.includeDev),
      detectZombies(sourceFiles, packageJson, options.includeDev),
      detectDuplicates(options.cwd),
      detectDrifts(options.cwd, packageJson, options.includeDev),
    ]);

    // 5. Calculate dependency health score
    const health = calculateHealthScore(ghosts, zombies, duplicates, drifts, options.penalties);

    const endTime = Date.now();
    const durationMs = endTime - startTime;

    // 6. Build and return the final report
    return {
      timestamp: new Date().toISOString(),
      durationMs,
      project: {
        name: packageJson.name || 'unnamed-project',
        version: packageJson.version || '0.0.0',
      },
      ghosts,
      zombies,
      duplicates,
      drifts,
      health,
    };
  } catch (error: unknown) {
    const err = error as Error;
    throw new Error(`Scan execution failed: ${err.message}`);
  }
}
