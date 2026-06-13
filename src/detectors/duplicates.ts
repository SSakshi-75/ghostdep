import { promises as fs } from 'fs';
import { join } from 'path';
import { DuplicateDependency, DuplicateDependencyInstance } from '../types.js';

/**
 * Detects packages with duplicate versions installed under node_modules.
 *
 * Works cross-platform and supports npm, pnpm, and yarn by walking the active
 * dependency graph in node_modules, resolving symlinks canonical-paths (to handle
 * pnpm structures without infinite loops) and tracking visited packages.
 *
 * @param projectRoot Absolute path to the project root directory
 * @returns Array of DuplicateDependency details
 */
export async function detectDuplicates(projectRoot: string): Promise<DuplicateDependency[]> {
  const nodeModulesPath = join(projectRoot, 'node_modules');
  const visitedPaths = new Set<string>();

  // Maps: packageName -> Map(versionString -> Array of relative path strings)
  const packageVersionsMap = new Map<string, Map<string, string[]>>();

  /**
   * Helper recursive function to walk package directories.
   */
  async function walk(dirPath: string, relativePathPrefix: string) {
    try {
      // Canonicalize the path to handle symlinks (crucial for pnpm / yarn berry)
      const realPath = await fs.realpath(dirPath);
      if (visitedPaths.has(realPath)) {
        return;
      }
      visitedPaths.add(realPath);

      let pkgName: string | undefined;
      let pkgVersion: string | undefined;

      // Try reading package.json of the current directory
      try {
        const pkgJsonContent = await fs.readFile(join(dirPath, 'package.json'), 'utf8');
        const pkgJson = JSON.parse(pkgJsonContent) as { name?: string; version?: string };
        pkgName = pkgJson.name;
        pkgVersion = pkgJson.version;
      } catch {
        // No valid package.json in this directory, skip reading it as a package
      }

      if (pkgName && pkgVersion) {
        let versionMap = packageVersionsMap.get(pkgName);
        if (!versionMap) {
          versionMap = new Map<string, string[]>();
          packageVersionsMap.set(pkgName, versionMap);
        }

        let pathsList = versionMap.get(pkgVersion);
        if (!pathsList) {
          pathsList = [];
          versionMap.set(pkgVersion, pathsList);
        }

        pathsList.push(relativePathPrefix);
      }

      // Check for nested node_modules folder (typical in npm / yarn classic)
      const nestedNodeModules = join(dirPath, 'node_modules');
      try {
        const entries = await fs.readdir(nestedNodeModules, { withFileTypes: true });
        for (const entry of entries) {
          // Skip internal/hidden folders
          if (entry.name.startsWith('.')) {
            continue;
          }

          if (entry.isDirectory() || entry.isSymbolicLink()) {
            const entryPath = join(nestedNodeModules, entry.name);
            const nextPrefix = relativePathPrefix
              ? `${relativePathPrefix}/node_modules/${entry.name}`
              : `node_modules/${entry.name}`;

            if (entry.name.startsWith('@')) {
              // Read scoped packages directory
              try {
                const scopeEntries = await fs.readdir(entryPath, { withFileTypes: true });
                for (const scopeEntry of scopeEntries) {
                  if (scopeEntry.isDirectory() || scopeEntry.isSymbolicLink()) {
                    const scopeEntryPath = join(entryPath, scopeEntry.name);
                    const scopeNextPrefix = `${nextPrefix}/${scopeEntry.name}`;
                    await walk(scopeEntryPath, scopeNextPrefix);
                  }
                }
              } catch {
                // Ignore failures to read scoped package directories
              }
            } else {
              await walk(entryPath, nextPrefix);
            }
          }
        }
      } catch {
        // Nested node_modules directory does not exist or is unreadable
      }
    } catch {
      // Path resolution failed (e.g. broken symlink), skip directory safely
    }
  }

  // Start walking from the root node_modules directory
  try {
    const rootEntries = await fs.readdir(nodeModulesPath, { withFileTypes: true });
    for (const entry of rootEntries) {
      if (entry.name.startsWith('.')) {
        continue;
      }

      if (entry.isDirectory() || entry.isSymbolicLink()) {
        const entryPath = join(nodeModulesPath, entry.name);
        const relativePrefix = `node_modules/${entry.name}`;

        if (entry.name.startsWith('@')) {
          try {
            const scopeEntries = await fs.readdir(entryPath, { withFileTypes: true });
            for (const scopeEntry of scopeEntries) {
              if (scopeEntry.isDirectory() || scopeEntry.isSymbolicLink()) {
                const scopeEntryPath = join(entryPath, scopeEntry.name);
                const scopeRelativePrefix = `${relativePrefix}/${scopeEntry.name}`;
                await walk(scopeEntryPath, scopeRelativePrefix);
              }
            }
          } catch {
            // Ignore scoped subdirectory read errors
          }
        } else {
          await walk(entryPath, relativePrefix);
        }
      }
    }
  } catch {
    // node_modules doesn't exist, is unreadable, or project isn't installed
  }

  // Format and collect final duplicates mapping
  const duplicates: DuplicateDependency[] = [];

  for (const [name, versionMap] of packageVersionsMap.entries()) {
    if (versionMap.size > 1) {
      const versions: DuplicateDependencyInstance[] = [];
      for (const [version, paths] of versionMap.entries()) {
        versions.push({
          version,
          paths,
        });
      }
      duplicates.push({
        name,
        versions,
      });
    }
  }

  return duplicates;
}
