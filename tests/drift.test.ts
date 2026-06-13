import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { detectDrifts } from '../src/detectors/drift.js';
import { PackageJson } from '../src/types.js';

// Mock the fs module
vi.mock('fs', () => {
  return {
    promises: {
      readFile: vi.fn(),
    },
  };
});

describe('detectDrifts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should detect no drift when versions match ranges exactly', async () => {
    const packageJson: PackageJson = {
      dependencies: {
        lodash: '^4.17.21',
      },
    };

    // Mock installed version to be 4.17.21
    vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify({ version: '4.17.21' }));

    const results = await detectDrifts('/project', packageJson, false);
    expect(results).toHaveLength(0);
  });

  it('should detect minor version drift when range satisfies but is newer', async () => {
    const packageJson: PackageJson = {
      dependencies: {
        lodash: '^4.17.0',
      },
    };

    // minVersion('^4.17.0') is 4.17.0. Installed is 4.18.0. Drift should be minor.
    vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify({ version: '4.18.0' }));

    const results = await detectDrifts('/project', packageJson, false);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      name: 'lodash',
      dependencyType: 'dependencies',
      declaredVersion: '^4.17.0',
      installedVersion: '4.18.0',
      driftType: 'minor',
    });
  });

  it('should detect major version drift', async () => {
    const packageJson: PackageJson = {
      dependencies: {
        lodash: '^4.0.0',
      },
    };

    // minVersion('^4.0.0') is 4.0.0. Installed is 5.0.0. Drift is major.
    vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify({ version: '5.0.0' }));

    const results = await detectDrifts('/project', packageJson, false);
    expect(results).toHaveLength(1);
    expect(results[0]?.driftType).toBe('major');
  });

  it('should detect missing dependencies (not installed in node_modules)', async () => {
    const packageJson: PackageJson = {
      dependencies: {
        lodash: '^4.17.21',
      },
    };

    // Simulate file not found when reading installed package.json
    vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('ENOENT'));

    const results = await detectDrifts('/project', packageJson, false);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      name: 'lodash',
      dependencyType: 'dependencies',
      declaredVersion: '^4.17.21',
      installedVersion: null,
      driftType: 'missing',
    });
  });

  it('should fall back to string comparison and flag major drift for non-semver descriptors', async () => {
    const packageJson: PackageJson = {
      dependencies: {
        'my-pkg': 'git+https://github.com/user/repo.git#v1.0.0',
      },
    };

    // Mismatched installed version
    vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify({ version: '1.2.0' }));

    const results = await detectDrifts('/project', packageJson, false);
    expect(results).toHaveLength(1);
    expect(results[0]?.driftType).toBe('major');
  });

  it('should check devDependencies if includeDev is enabled', async () => {
    const packageJson: PackageJson = {
      dependencies: {
        prod: '^1.0.0',
      },
      devDependencies: {
        dev: '^2.0.0',
      },
    };

    // mock prod matching, dev drifting (installed is 3.0.0)
    vi.mocked(fs.readFile)
      .mockResolvedValueOnce(JSON.stringify({ version: '1.0.0' })) // prod
      .mockResolvedValueOnce(JSON.stringify({ version: '3.0.0' })); // dev

    const results = await detectDrifts('/project', packageJson, true);
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('dev');
    expect(results[0]?.dependencyType).toBe('devDependencies');
    expect(results[0]?.driftType).toBe('major');
  });
});
