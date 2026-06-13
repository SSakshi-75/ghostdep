import { promises as fs } from 'fs';
import { join } from 'path';
import { GhostDependency, PackageJson } from '../types.js';

const BUILTINS = new Set([
  'assert',
  'async_hooks',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'diagnostics_channel',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'http2',
  'https',
  'inspector',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'sys',
  'timers',
  'tls',
  'trace_events',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'wasi',
  'worker_threads',
  'zlib',
]);

/**
 * Checks if a package name is a Node.js built-in module.
 */
function isBuiltin(name: string): boolean {
  return name.startsWith('node:') || BUILTINS.has(name);
}

/**
 * Extracts the core package name from an import specifier.
 * E.g., "lodash/map" -> "lodash", "@types/node/index.d.ts" -> "@types/node"
 */
function getPackageName(specifier: string): string | null {
  if (!specifier || specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('file:')) {
    return null;
  }

  const parts = specifier.split('/');
  if (specifier.startsWith('@')) {
    return parts[0] && parts[1] ? `${parts[0]}/${parts[1]}` : null;
  }
  return parts[0] || null;
}

/**
 * Scans a file to extract all external import/require specifiers.
 */
async function extractImports(filePath: string): Promise<string[]> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const specifiers = new Set<string>();

    // ESM Imports & Exports matching
    const esmImportRegex = /import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g;
    const esmExportRegex = /export\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g;
    // CommonJS require & Dynamic imports matching
    const dynamicOrCjsRegex = /(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    let match;
    while ((match = esmImportRegex.exec(content)) !== null) {
      if (match[1]) specifiers.add(match[1]);
    }
    while ((match = esmExportRegex.exec(content)) !== null) {
      if (match[1]) specifiers.add(match[1]);
    }
    while ((match = dynamicOrCjsRegex.exec(content)) !== null) {
      if (match[1]) specifiers.add(match[1]);
    }

    return Array.from(specifiers);
  } catch {
    // If a file cannot be read, return empty imports
    return [];
  }
}

/**
 * Scans the node_modules folder to find all installed package names,
 * ignoring internal folders starting with a dot (like .bin, .cache, .pnpm).
 */
async function getInstalledPackages(projectRoot: string): Promise<Set<string>> {
  const installed = new Set<string>();
  const nodeModulesPath = join(projectRoot, 'node_modules');

  try {
    const entries = await fs.readdir(nodeModulesPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const name = entry.name;
        // Ignore internal directories
        if (name.startsWith('.')) {
          continue;
        }

        if (name.startsWith('@')) {
          // Read scope folder entries
          const scopePath = join(nodeModulesPath, name);
          try {
            const subEntries = await fs.readdir(scopePath, { withFileTypes: true });
            for (const subEntry of subEntries) {
              if (subEntry.isDirectory()) {
                installed.add(`${name}/${subEntry.name}`);
              }
            }
          } catch {
            // Ignore reading sub-scopes failure
          }
        } else {
          installed.add(name);
        }
      }
    }
  } catch {
    // Return empty set if node_modules does not exist
  }

  return installed;
}

/**
 * Detects ghost dependencies: packages imported in the source code
 * that are installed in node_modules but not listed in package.json.
 *
 * @param projectRoot Absolute path to the project root directory
 * @param sourceFiles List of absolute paths of source files to analyze
 * @param packageJson Parsed package.json object
 * @param includeDev Whether to include devDependencies as declared packages
 * @returns Array of detected ghost dependencies
 */
export async function detectGhosts(
  projectRoot: string,
  sourceFiles: string[],
  packageJson: PackageJson,
  includeDev: boolean = false
): Promise<GhostDependency[]> {
  try {
    // 1. Gather all declared package names from package.json
    const declaredPackages = new Set<string>();

    if (packageJson.dependencies) {
      Object.keys(packageJson.dependencies).forEach((dep) => declaredPackages.add(dep));
    }

    if (includeDev && packageJson.devDependencies) {
      Object.keys(packageJson.devDependencies).forEach((dep) => declaredPackages.add(dep));
    }

    if (packageJson.peerDependencies) {
      Object.keys(packageJson.peerDependencies).forEach((dep) => declaredPackages.add(dep));
    }

    if (packageJson.optionalDependencies) {
      Object.keys(packageJson.optionalDependencies).forEach((dep) => declaredPackages.add(dep));
    }

    // 2. Identify all installed packages in node_modules
    const installedPackages = await getInstalledPackages(projectRoot);

    // 3. Scan source files for imports and identify undeclared usages
    const ghostMap = new Map<string, { files: Set<string>; specifiers: Set<string> }>();

    for (const file of sourceFiles) {
      const cleanRoot = projectRoot.replace(/\\/g, '/');
      const cleanFile = file.replace(/\\/g, '/');
      const relativePath = cleanFile.replace(cleanRoot, '').replace(/^[\\/]/, '');
      const importSpecifiers = await extractImports(file);

      for (const specifier of importSpecifiers) {
        const pkgName = getPackageName(specifier);

        if (!pkgName || isBuiltin(pkgName)) {
          continue;
        }

        // It is a ghost dependency if it is NOT declared, but is installed in node_modules
        if (!declaredPackages.has(pkgName) && installedPackages.has(pkgName)) {
          let entry = ghostMap.get(pkgName);
          if (!entry) {
            entry = { files: new Set<string>(), specifiers: new Set<string>() };
            ghostMap.set(pkgName, entry);
          }
          entry.files.add(relativePath);
          entry.specifiers.add(specifier);
        }
      }
    }

    // 4. Map the results into the typed output
    const results: GhostDependency[] = [];
    for (const [name, data] of ghostMap.entries()) {
      results.push({
        name,
        files: Array.from(data.files),
        specifiers: Array.from(data.specifiers),
      });
    }

    return results;
  } catch (error: unknown) {
    const err = error as Error;
    throw new Error(`Ghost dependency detection failed: ${err.message}`);
  }
}
