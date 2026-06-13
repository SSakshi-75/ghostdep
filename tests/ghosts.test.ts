import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { detectGhosts } from '../src/detectors/ghosts.js';
import { PackageJson } from '../src/types.js';

vi.mock('fs', () => {
  return {
    promises: {
      readFile: vi.fn(),
      readdir: vi.fn(),
    },
  };
});

describe('detectGhosts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should detect ghost dependencies (imported but not declared)', async () => {
    const packageJson: PackageJson = {
      dependencies: {
        lodash: '^4.17.21',
      },
    };

    // Code imports both lodash and axios
    const code = `
      import _ from 'lodash';
      import axios from 'axios';
      console.log(axios.get);
    `;

    // 1. Mock readdir for node_modules: returns lodash and axios as installed
    vi.mocked(fs.readdir).mockResolvedValueOnce([
      { name: 'lodash', isDirectory: () => true, isSymbolicLink: () => false },
      { name: 'axios', isDirectory: () => true, isSymbolicLink: () => false },
    ] as any);

    // 2. Mock readFile for source file
    vi.mocked(fs.readFile).mockResolvedValueOnce(code);

    const results = await detectGhosts('/project', ['/project/src/index.ts'], packageJson, false);

    // axios is imported and installed, but not declared -> ghost!
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('axios');
    expect(results[0]?.files).toContain('src/index.ts');
    expect(results[0]?.specifiers).toContain('axios');
  });

  it('should ignore Node.js standard library built-ins', async () => {
    const packageJson: PackageJson = {};

    // Code imports built-in modules
    const code = `
      import fs from 'fs';
      import path from 'node:path';
    `;

    vi.mocked(fs.readdir).mockResolvedValueOnce([] as any); // no packages installed
    vi.mocked(fs.readFile).mockResolvedValueOnce(code);

    const results = await detectGhosts('/project', ['/project/src/index.ts'], packageJson, false);
    expect(results).toHaveLength(0);
  });

  it('should ignore packages that are declared in peer or optional dependencies', async () => {
    const packageJson: PackageJson = {
      peerDependencies: {
        react: '^18.0.0',
      },
      optionalDependencies: {
        fsevents: '^2.3.2',
      },
    };

    const code = `
      import React from 'react';
      import 'fsevents';
    `;

    vi.mocked(fs.readdir).mockResolvedValueOnce([
      { name: 'react', isDirectory: () => true, isSymbolicLink: () => false },
      { name: 'fsevents', isDirectory: () => true, isSymbolicLink: () => false },
    ] as any);
    vi.mocked(fs.readFile).mockResolvedValueOnce(code);

    const results = await detectGhosts('/project', ['/project/src/index.ts'], packageJson, false);
    expect(results).toHaveLength(0);
  });

  it('should resolve scoped packages correctly', async () => {
    const packageJson: PackageJson = {};

    const code = `
      import { something } from '@company/utils/helpers';
    `;

    // Mock readdir for node_modules: includes a scoped @company directory
    vi.mocked(fs.readdir)
      .mockResolvedValueOnce([{ name: '@company', isDirectory: () => true, isSymbolicLink: () => false }] as any) // root node_modules readdir
      .mockResolvedValueOnce([{ name: 'utils', isDirectory: () => true, isSymbolicLink: () => false }] as any); // scoped @company folder readdir

    vi.mocked(fs.readFile).mockResolvedValueOnce(code);

    const results = await detectGhosts('/project', ['/project/src/index.ts'], packageJson, false);

    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('@company/utils');
    expect(results[0]?.specifiers).toContain('@company/utils/helpers');
  });
});
