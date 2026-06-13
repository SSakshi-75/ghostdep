import { join } from 'path';
import { promises as fs } from 'fs';
import { PackageJson } from '../types.js';

export type PackageManagerType = 'npm' | 'yarn' | 'pnpm';

/**
 * Reads and parses package.json from the specified directory path.
 *
 * @param projectRoot Absolute path to the project root directory
 * @returns Parsed PackageJson object
 * @throws Error if the file cannot be read or parsed
 */
export async function readPackageJson(projectRoot: string): Promise<PackageJson> {
  const filePath = join(projectRoot, 'package.json');
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as PackageJson;
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      throw new Error(`package.json was not found at "${filePath}".`);
    }
    throw new Error(`Failed to parse package.json at "${filePath}": ${err.message}`);
  }
}

/**
 * Detects the active package manager of the project by verifying lockfiles
 * or inspecting the "packageManager" property in package.json.
 * Defaults to "npm" if no package manager can be identified.
 *
 * @param projectRoot Absolute path to the project root directory
 * @returns The identified package manager ('npm' | 'yarn' | 'pnpm')
 */
export async function detectPackageManager(projectRoot: string): Promise<PackageManagerType> {
  try {
    const checkFileExists = async (filename: string): Promise<boolean> => {
      try {
        await fs.access(join(projectRoot, filename));
        return true;
      } catch {
        return false;
      }
    };

    const [hasPnpm, hasYarn, hasNpm] = await Promise.all([
      checkFileExists('pnpm-lock.yaml'),
      checkFileExists('yarn.lock'),
      checkFileExists('package-lock.json'),
    ]);

    if (hasPnpm) return 'pnpm';
    if (hasYarn) return 'yarn';
    if (hasNpm) return 'npm';

    // Fallback: inspect packageManager field inside package.json
    try {
      const pkg = await readPackageJson(projectRoot);
      if (pkg.packageManager) {
        const [name] = pkg.packageManager.split('@');
        if (name === 'npm' || name === 'yarn' || name === 'pnpm') {
          return name as PackageManagerType;
        }
      }
    } catch {
      // Fallback silently if package.json does not exist or fails parsing
    }

    return 'npm';
  } catch (error: unknown) {
    const err = error as Error;
    throw new Error(`Package manager detection failed: ${err.message}`);
  }
}
