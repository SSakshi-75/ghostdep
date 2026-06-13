import { promises as fs } from 'fs';
import ts from 'typescript';
import { ZombieDependency, PackageJson } from '../types.js';

/**
 * Extracts the base package name from an import specifier.
 * E.g., "lodash/map" -> "lodash", "@types/node" -> "@types/node"
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
 * Parses a TS/JS file using the TypeScript Compiler API AST,
 * returning a Set of all imported package specifiers.
 *
 * Supports:
 * - import declarations: static imports and re-exports
 * - dynamic imports: import('pkg')
 * - CommonJS require statements
 */
export function findImportsInAST(filePath: string, fileContent: string): Set<string> {
  const imports = new Set<string>();

  // Create AST representation of the source file
  const sourceFile = ts.createSourceFile(filePath, fileContent, ts.ScriptTarget.Latest, true);

  function visit(node: ts.Node) {
    // 1. Static imports: e.g. import x from 'y'
    if (ts.isImportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        imports.add(node.moduleSpecifier.text);
      }
    }
    // 2. Export re-exports: e.g. export * from 'y'
    else if (ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        imports.add(node.moduleSpecifier.text);
      }
    }
    // 3. Dynamic imports or CJS require expressions
    else if (ts.isCallExpression(node)) {
      const expression = node.expression;

      // Dynamic import: import('y')
      if (expression.kind === ts.SyntaxKind.ImportKeyword) {
        const arg = node.arguments[0];
        if (arg && ts.isStringLiteral(arg)) {
          imports.add(arg.text);
        }
      }
      // require('y')
      else if (ts.isIdentifier(expression) && expression.text === 'require') {
        const arg = node.arguments[0];
        if (arg && ts.isStringLiteral(arg)) {
          imports.add(arg.text);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return imports;
}

/**
 * Detects zombie dependencies: packages declared in package.json dependencies list
 * but never imported or required in the codebase.
 *
 * @param sourceFiles Absolute paths of all source files in the project
 * @param packageJson Parsed package.json object
 * @param includeDev Whether to scan and include devDependencies as candidate zombies
 * @returns Array of ZombieDependency findings
 */
export async function detectZombies(
  sourceFiles: string[],
  packageJson: PackageJson,
  includeDev: boolean = false
): Promise<ZombieDependency[]> {
  try {
    // 1. Map all candidate declared dependencies to check
    const declaredMap = new Map<string, { type: ZombieDependency['type']; declaredVersion: string }>();

    const addCandidates = (deps: Record<string, string> | undefined, type: ZombieDependency['type']) => {
      if (deps) {
        for (const [name, version] of Object.entries(deps)) {
          declaredMap.set(name, { type, declaredVersion: version });
        }
      }
    };

    addCandidates(packageJson.dependencies, 'dependencies');
    if (includeDev) {
      addCandidates(packageJson.devDependencies, 'devDependencies');
    }
    addCandidates(packageJson.peerDependencies, 'peerDependencies');
    addCandidates(packageJson.optionalDependencies, 'optionalDependencies');

    // 2. Traverse all source files to find all imports
    const usedPackages = new Set<string>();

    for (const file of sourceFiles) {
      try {
        const content = await fs.readFile(file, 'utf8');
        const fileImports = findImportsInAST(file, content);

        for (const specifier of fileImports) {
          const pkgName = getPackageName(specifier);
          if (pkgName) {
            usedPackages.add(pkgName);
          }
        }
      } catch {
        // Skip file quietly if reading/parsing fails (e.g. binary or empty file)
      }
    }

    // 3. Find packages that are declared but never used in any scanned source file
    const zombies: ZombieDependency[] = [];

    for (const [name, details] of declaredMap.entries()) {
      if (!usedPackages.has(name)) {
        zombies.push({
          name,
          type: details.type,
          declaredVersion: details.declaredVersion,
        });
      }
    }

    return zombies;
  } catch (error: unknown) {
    const err = error as Error;
    throw new Error(`Zombie dependency detection failed: ${err.message}`);
  }
}
