import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { detectZombies } from '../src/detectors/zombies.js';
import { PackageJson } from '../src/types.js';

vi.mock('fs', () => {
  return {
    promises: {
      readFile: vi.fn(),
    },
  };
});

describe('detectZombies', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should find unused declared dependencies (zombies)', async () => {
    const packageJson: PackageJson = {
      dependencies: {
        lodash: '^4.17.21',
        express: '^4.17.1',
      },
    };

    // The code only imports 'lodash'
    const code = `
      import _ from 'lodash';
      console.log(_.map([1, 2], x => x * 2));
    `;

    vi.mocked(fs.readFile).mockResolvedValueOnce(code);

    const results = await detectZombies(['/project/src/index.ts'], packageJson, false);

    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('express');
    expect(results[0]?.type).toBe('dependencies');
  });

  it('should support dynamic imports and require statements', async () => {
    const packageJson: PackageJson = {
      dependencies: {
        lodash: '^4.17.21',
        express: '^4.17.1',
        chalk: '^5.0.0',
      },
    };

    // Index imports lodash dynamically, and requires express
    const code = `
      const express = require('express');
      import('chalk').then(m => m.default.blue('hello'));
    `;

    vi.mocked(fs.readFile).mockResolvedValueOnce(code);

    const results = await detectZombies(['/project/src/index.ts'], packageJson, false);

    // lodash is declared but never imported/required
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('lodash');
  });

  it('should check devDependencies if includeDev option is true', async () => {
    const packageJson: PackageJson = {
      dependencies: {
        lodash: '^4.17.21',
      },
      devDependencies: {
        vitest: '^1.6.0',
      },
    };

    // Code imports lodash, but not vitest
    const code = "import 'lodash';";
    vi.mocked(fs.readFile).mockResolvedValueOnce(code);

    // 1. With includeDev = false (should skip devDependencies, so no zombies)
    const resNoDev = await detectZombies(['/project/src/index.ts'], packageJson, false);
    expect(resNoDev).toHaveLength(0);

    // Reset mocks for next run
    vi.mocked(fs.readFile).mockResolvedValueOnce(code);

    // 2. With includeDev = true (should find vitest as zombie)
    const resWithDev = await detectZombies(['/project/src/index.ts'], packageJson, true);
    expect(resWithDev).toHaveLength(1);
    expect(resWithDev[0]?.name).toBe('vitest');
    expect(resWithDev[0]?.type).toBe('devDependencies');
  });

  it('should identify re-exports as usage', async () => {
    const packageJson: PackageJson = {
      dependencies: {
        shared: '^1.0.0',
      },
    };

    // Code re-exports from 'shared'
    const code = "export * from 'shared';";
    vi.mocked(fs.readFile).mockResolvedValueOnce(code);

    const results = await detectZombies(['/project/src/index.ts'], packageJson, false);
    expect(results).toHaveLength(0); // 'shared' is used via re-export
  });
});
