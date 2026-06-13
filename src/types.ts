export interface GhostDependency {
  /** Name of the imported package that is not declared in package.json */
  name: string;
  /** List of files (relative paths) where this package was imported */
  files: string[];
  /** The import specifiers used in code (e.g. "lodash/map") */
  specifiers: string[];
}

export interface ZombieDependency {
  /** Name of the package declared in package.json but not used in code */
  name: string;
  /** Section under which it is declared in package.json */
  type: 'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies';
  /** The version range declared in package.json */
  declaredVersion: string;
}

export interface DuplicateDependencyInstance {
  /** The resolved actual version */
  version: string;
  /** Paths to the directory in node_modules resolving to this version */
  paths: string[];
}

export interface DuplicateDependency {
  /** Name of the package with duplicate versions installed */
  name: string;
  /** Array of installed versions and their locations */
  versions: DuplicateDependencyInstance[];
}

export interface VersionDrift {
  /** Name of the package */
  name: string;
  /** Section under which it is declared in package.json */
  dependencyType: 'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies';
  /** The version range declared in package.json */
  declaredVersion: string;
  /** The actual version resolved/installed in node_modules (null if not installed) */
  installedVersion: string | null;
  /** Categorization of the drift gap */
  driftType: 'major' | 'minor' | 'patch' | 'missing' | 'none';
}

export interface HealthDeduction {
  /** Reason for the deduction (e.g. "2 ghost dependencies detected") */
  reason: string;
  /** Points deducted from the 100 base score */
  penalty: number;
}

export interface HealthScore {
  /** Overall calculated health score from 0 to 100 */
  score: number;
  /** Letter grade based on the score */
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  /** Quantities of various issues found */
  metrics: {
    ghosts: number;
    zombies: number;
    duplicates: number;
    drifts: number;
  };
  /** Detail of deductions applied to reach the final score */
  deductions: HealthDeduction[];
}

export interface ProjectMetadata {
  /** Name of the analyzed project from package.json */
  name: string;
  /** Version of the analyzed project from package.json */
  version: string;
}

export interface PackageJson {
  name?: string;
  version?: string;
  packageManager?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

export interface ScanReport {
  /** Timestamp when the scan was executed */
  timestamp: string;
  /** Time taken to run the analysis in milliseconds */
  durationMs: number;
  /** Analyzed project's metadata */
  project: ProjectMetadata;
  /** Detected ghost dependencies */
  ghosts: GhostDependency[];
  /** Detected zombie dependencies */
  zombies: ZombieDependency[];
  /** Detected duplicate package versions */
  duplicates: DuplicateDependency[];
  /** Detected version drift issues */
  drifts: VersionDrift[];
  /** Overall calculated health metrics */
  health: HealthScore;
}

export interface ScanOptions {
  /** Working directory to scan (defaults to process.cwd()) */
  cwd: string;
  /** Glob patterns to search for source code files */
  include: string[];
  /** Glob patterns to exclude from source code scan (e.g. node_modules, dist, test files) */
  exclude: string[];
  /** Whether to scan and include devDependencies in audits */
  includeDev: boolean;
  /** Custom penalties for issues when calculating the health score */
  penalties?: {
    ghost?: number;
    zombie?: number;
    duplicate?: number;
    driftMajor?: number;
    driftMinor?: number;
    driftPatch?: number;
    missing?: number;
  };
}
