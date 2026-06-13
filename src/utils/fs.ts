import { join } from 'path';
import { promises as fs } from 'fs';
import fg from 'fast-glob';
import { PackageJson } from '../types.js';

/**
 * Generic utility to read and parse a JSON file asynchronously.
 *
 * @param filePath Absolute path to the JSON file
 * @returns Parsed JSON object of type T
 * @throws Error if the file cannot be read or parsed
 */
export async function readJson<T = unknown>(filePath: string): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      throw new Error(`JSON file was not found at "${filePath}".`);
    }
    throw new Error(`Failed to read or parse JSON file at "${filePath}": ${err.message}`);
  }
}

/**
 * Reads and parses package.json from the specified directory path.
 *
 * @param projectRoot Absolute path to the project root directory
 * @returns Parsed PackageJson object
 * @throws Error if the file cannot be read or parsed
 */
export async function readPackageJson(projectRoot: string): Promise<PackageJson> {
  const filePath = join(projectRoot, 'package.json');
  return readJson<PackageJson>(filePath);
}

/**
 * Recursively scans folders for source files matching specified patterns,
 * ignoring .git, node_modules, and common build/output directories.
 *
 * @param directory Absolute path to the directory to scan
 * @param patterns Array of glob patterns to match (defaults to common JS/TS extensions)
 * @param extraIgnores Optional array of extra glob patterns to ignore
 * @returns List of absolute file paths matching the scan
 * @throws Error if directory scanning fails
 */
export async function scanFiles(
  directory: string,
  patterns: string[] = ['**/*.{js,jsx,ts,tsx,mjs,cjs}'],
  extraIgnores: string[] = []
): Promise<string[]> {
  try {
    const defaultIgnores = [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.nyc_output/**',
    ];

    const ignore = [...defaultIgnores, ...extraIgnores];

    // fast-glob requires forward slashes for cross-platform glob matching
    const cleanDir = directory.replace(/\\/g, '/');

    const files = await fg(patterns, {
      cwd: cleanDir,
      ignore,
      absolute: true,
      onlyFiles: true,
      dot: false, // Don't match dotfiles by default (e.g. .eslintrc) unless specified
    });

    return files;
  } catch (error: unknown) {
    const err = error as Error;
    throw new Error(`Failed to scan files in directory "${directory}": ${err.message}`);
  }
}
