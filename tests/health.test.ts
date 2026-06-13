import { describe, it, expect } from 'vitest';
import { calculateHealthScore } from '../src/health.js';
import { GhostDependency, ZombieDependency, DuplicateDependency, VersionDrift } from '../src/types.js';

describe('calculateHealthScore', () => {
  it('should return 100 and grade A when there are no issues', () => {
    const score = calculateHealthScore([], [], [], []);
    expect(score.score).toBe(100);
    expect(score.grade).toBe('A');
    expect(score.deductions).toHaveLength(0);
    expect(score.metrics).toEqual({
      ghosts: 0,
      zombies: 0,
      duplicates: 0,
      drifts: 0,
    });
  });

  it('should apply correct default deductions for each issue type', () => {
    const dummyGhosts: GhostDependency[] = [
      { name: 'ghost-1', files: ['file.ts'], specifiers: ['ghost-1'] },
      { name: 'ghost-2', files: ['file.ts'], specifiers: ['ghost-2'] },
    ]; // 2 * -5 = -10

    const dummyZombies: ZombieDependency[] = [{ name: 'zombie-1', type: 'dependencies', declaredVersion: '^1.0.0' }]; // 1 * -5 = -5

    const dummyDuplicates: DuplicateDependency[] = [{ name: 'dup-1', versions: [] }]; // 1 * -3 = -3

    const dummyDrifts: VersionDrift[] = [
      {
        name: 'drift-1',
        dependencyType: 'dependencies',
        declaredVersion: '^1.0.0',
        installedVersion: '2.0.0',
        driftType: 'major',
      },
      {
        name: 'drift-2',
        dependencyType: 'dependencies',
        declaredVersion: '^1.0.0',
        installedVersion: '1.1.0',
        driftType: 'minor',
      },
    ]; // 2 * -2 = -4

    // Expected total score: 100 - 10 - 5 - 3 - 4 = 78 (Grade: C)
    const result = calculateHealthScore(dummyGhosts, dummyZombies, dummyDuplicates, dummyDrifts);

    expect(result.score).toBe(78);
    expect(result.grade).toBe('C');
    expect(result.metrics).toEqual({
      ghosts: 2,
      zombies: 1,
      duplicates: 1,
      drifts: 2,
    });
    expect(result.deductions).toContainEqual({
      reason: '2 ghost dependencies detected',
      penalty: 10,
    });
    expect(result.deductions).toContainEqual({
      reason: '1 zombie dependency detected',
      penalty: 5,
    });
    expect(result.deductions).toContainEqual({
      reason: '1 duplicate package detected',
      penalty: 3,
    });
    expect(result.deductions).toContainEqual({
      reason: '2 version drifts (1 major, 1 minor)',
      penalty: 4,
    });
  });

  it('should cap the minimum score at 0', () => {
    const manyGhosts: GhostDependency[] = Array.from({ length: 30 }, (_, i) => ({
      name: `ghost-${i}`,
      files: ['file.ts'],
      specifiers: [`ghost-${i}`],
    })); // 30 * -5 = -150

    const result = calculateHealthScore(manyGhosts, [], [], []);
    expect(result.score).toBe(0);
    expect(result.grade).toBe('F');
  });

  it('should respect custom penalties provided via options', () => {
    const dummyGhosts: GhostDependency[] = [{ name: 'ghost-1', files: ['file.ts'], specifiers: ['ghost-1'] }];
    const dummyDrifts: VersionDrift[] = [
      {
        name: 'drift-1',
        dependencyType: 'dependencies',
        declaredVersion: '^1.0.0',
        installedVersion: '2.0.0',
        driftType: 'major',
      },
      {
        name: 'drift-2',
        dependencyType: 'dependencies',
        declaredVersion: '^1.0.0',
        installedVersion: '1.0.1',
        driftType: 'patch',
      },
    ];

    const customPenalties = {
      ghost: 10, // -10
      driftMajor: 8, // -8
      driftPatch: 1, // -1
    };

    // Expected total: 100 - 10 - 8 - 1 = 81 (Grade: B)
    const result = calculateHealthScore(dummyGhosts, [], [], dummyDrifts, customPenalties);
    expect(result.score).toBe(81);
    expect(result.grade).toBe('B');
  });

  it('should assign correct grades based on score limits', () => {
    // A: 90-100
    expect(calculateHealthScore([], [], [], []).grade).toBe('A');

    // B: 80-89
    const bGhosts: GhostDependency[] = Array.from({ length: 3 }, () => ({
      name: 'g',
      files: [],
      specifiers: [],
    })); // 100 - 15 = 85
    expect(calculateHealthScore(bGhosts, [], [], []).grade).toBe('B');

    // C: 70-79
    const cGhosts: GhostDependency[] = Array.from({ length: 5 }, () => ({
      name: 'g',
      files: [],
      specifiers: [],
    })); // 100 - 25 = 75
    expect(calculateHealthScore(cGhosts, [], [], []).grade).toBe('C');

    // D: 60-69
    const dGhosts: GhostDependency[] = Array.from({ length: 7 }, () => ({
      name: 'g',
      files: [],
      specifiers: [],
    })); // 100 - 35 = 65
    expect(calculateHealthScore(dGhosts, [], [], []).grade).toBe('D');

    // F: <60
    const fGhosts: GhostDependency[] = Array.from({ length: 10 }, () => ({
      name: 'g',
      files: [],
      specifiers: [],
    })); // 100 - 50 = 50
    expect(calculateHealthScore(fGhosts, [], [], []).grade).toBe('F');
  });
});
