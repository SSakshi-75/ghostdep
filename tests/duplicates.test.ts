import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { detectDuplicates } from '../src/detectors/duplicates.js';

vi.mock('fs', () => {
  return {
    promises: {
      readdir: vi.fn(),
      readFile: vi.fn(),
      realpath: vi.fn((path) => Promise.resolve(path)), // Default behavior resolves to self
    },
  };
});

describe('detectDuplicates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect no duplicates when packages have unique versions', async () => {
    // Mock readdir to return some dependencies
    vi.mocked(fs.readdir).mockResolvedValueOnce([
      { name: 'lodash', isDirectory: () => true, isSymbolicLink: () => false },
      { name: 'express', isDirectory: () => true, isSymbolicLink: () => false },
    ] as any);

    // Mock each nested readdir (no sub node_modules)
    vi.mocked(fs.readdir).mockRejectedValue(new Error('ENOENT')); // For nested node_modules

    // Mock readFile to return unique versions
    vi.mocked(fs.readFile)
      .mockResolvedValueOnce(JSON.stringify({ name: 'lodash', version: '4.17.21' }))
      .mockResolvedValueOnce(JSON.stringify({ name: 'express', version: '4.17.1' }));

    const results = await detectDuplicates('/project');
    expect(results).toHaveLength(0);
  });

  it('should detect duplicate versions resolved in nested node_modules', async () => {
    // 1. Root readdir: returns lodash
    vi.mocked(fs.readdir).mockResolvedValueOnce([
      { name: 'lodash', isDirectory: () => true, isSymbolicLink: () => false },
    ] as any);

    // 2. nested readdir under root lodash: returns a nested node_modules folder
    vi.mocked(fs.readdir).mockResolvedValueOnce([
      { name: 'nested-dep', isDirectory: () => true, isSymbolicLink: () => false },
    ] as any);

    // 3. nested readdir under nested-dep node_modules: returns another lodash!
    vi.mocked(fs.readdir).mockResolvedValueOnce([
      { name: 'lodash', isDirectory: () => true, isSymbolicLink: () => false },
    ] as any);

    // Fallbacks for deeper readdirs
    vi.mocked(fs.readdir).mockRejectedValue(new Error('ENOENT'));

    // Mock package.json files:
    // First read: root lodash (v4.17.21)
    // Second read: nested-dep (v1.0.0)
    // Third read: nested lodash (v3.0.0)
    vi.mocked(fs.readFile)
      .mockResolvedValueOnce(JSON.stringify({ name: 'lodash', version: '4.17.21' }))
      .mockResolvedValueOnce(JSON.stringify({ name: 'nested-dep', version: '1.0.0' }))
      .mockResolvedValueOnce(JSON.stringify({ name: 'lodash', version: '3.0.0' }));

    const results = await detectDuplicates('/project');

    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('lodash');
    expect(results[0]?.versions).toHaveLength(2);

    const v4 = results[0]?.versions.find((v) => v.version === '4.17.21');
    const v3 = results[0]?.versions.find((v) => v.version === '3.0.0');

    expect(v4).toBeDefined();
    expect(v3).toBeDefined();
    expect(v4?.paths).toContain('node_modules/lodash');
  });

  it('should skip already visited paths to avoid cycles (pnpm symlinks)', async () => {
    vi.mocked(fs.readdir).mockResolvedValueOnce([
      { name: 'lodash', isDirectory: () => true, isSymbolicLink: () => true },
    ] as any);

    vi.mocked(fs.readdir).mockRejectedValue(new Error('ENOENT'));

    // Both realpath calls resolve to the same canonical path (simulating a circular symlink structure)
    vi.mocked(fs.realpath).mockResolvedValue('/project/node_modules/.pnpm/shared-path');

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ name: 'lodash', version: '4.17.21' }));

    const results = await detectDuplicates('/project');

    // lodash is visited once, cycle is broken, no duplicates
    expect(results).toHaveLength(0);
  });
});
