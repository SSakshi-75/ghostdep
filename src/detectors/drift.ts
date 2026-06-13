import { promises as fs } from 'fs';
import { join } from 'path';
import semver from 'semver';
import { VersionDrift, PackageJson } from '../types.js';

/**
 * Resolves the installed version of a package by reading its package.json inside node_modules.
 */
async function getInstalledVersion(projectRoot: string, packageName: string): Promise<string | null> {
  const packageJsonPath = join(projectRoot, 'node_modules', packageName, 'package.json');
  try {
    const content = await fs.readFile(packageJsonPath, 'utf8');
    const pkg = JSON.parse(content) as { version?: string };
    return pkg.version || null;
  } catch {
    return null;
  }
}

/**
 * Calculates the semver drift type between a declared range and the installed version.
 */
function calculateDriftType(declaredRange: string, installedVersion: string | null): VersionDrift['driftType'] {
  if (!installedVersion) {
    return 'missing';
  }

  // If the range is not valid semver (e.g. workspace:*, git URL, file path, latest)
  if (!semver.validRange(declaredRange)) {
    // Exact string match comparison fallback
    return declaredRange === installedVersion ? 'none' : 'major';
  }

  const minVersion = semver.minVersion(declaredRange);
  if (!minVersion) {
    return 'none';
  }

  const diff = semver.diff(minVersion.version, installedVersion);
  if (!diff) {
    return 'none';
  }

  if (diff === 'major' || diff === 'premajor') {
    return 'major';
  }
  if (diff === 'minor' || diff === 'preminor') {
    return 'minor';
  }
  if (diff === 'patch' || diff === 'prepatch' || diff === 'prerelease') {
    return 'patch';
  }

  return 'none';
}

/**
 * Detects version drift issues: discrepancies between the declared semver ranges
 * in package.json and the actual installed package versions in node_modules.
 *
 * @param projectRoot Absolute path to the project root directory
 * @param packageJson Parsed package.json object
 * @param includeDev Whether to include devDependencies in the drift check
 * @returns Array of VersionDrift results
 */
export async function detectDrifts(
  projectRoot: string,
  packageJson: PackageJson,
  includeDev: boolean = false
): Promise<VersionDrift[]> {
  try {
    const candidates: { name: string; declaredVersion: string; dependencyType: VersionDrift['dependencyType'] }[] = [];

    const addCandidates = (
      deps: Record<string, string> | undefined,
      dependencyType: VersionDrift['dependencyType']
    ) => {
      if (deps) {
        for (const [name, version] of Object.entries(deps)) {
          candidates.push({ name, declaredVersion: version, dependencyType });
        }
      }
    };

    addCandidates(packageJson.dependencies, 'dependencies');
    if (includeDev) {
      addCandidates(packageJson.devDependencies, 'devDependencies');
    }
    addCandidates(packageJson.peerDependencies, 'peerDependencies');
    addCandidates(packageJson.optionalDependencies, 'optionalDependencies');

    const drifts: VersionDrift[] = [];

    for (const candidate of candidates) {
      const installedVersion = await getInstalledVersion(projectRoot, candidate.name);
      const driftType = calculateDriftType(candidate.declaredVersion, installedVersion);

      if (driftType !== 'none') {
        drifts.push({
          name: candidate.name,
          dependencyType: candidate.dependencyType,
          declaredVersion: candidate.declaredVersion,
          installedVersion,
          driftType,
        });
      }
    }

    return drifts;
  } catch (error: unknown) {
    const err = error as Error;
    throw new Error(`Version drift detection failed: ${err.message}`);
  }
}
