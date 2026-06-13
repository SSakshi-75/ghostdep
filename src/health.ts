import {
  HealthScore,
  GhostDependency,
  ZombieDependency,
  DuplicateDependency,
  VersionDrift,
  HealthDeduction,
  ScanOptions,
} from './types.js';

/**
 * Calculates the dependency health score and grade of a project.
 *
 * Score Formula:
 * - Starting Base: 100
 * - Deductions:
 *   - -5 per ghost dependency
 *   - -5 per zombie dependency
 *   - -3 per duplicate dependency
 *   - -2 per version drift (by default)
 * - Minimum bounded score: 0
 *
 * @param ghosts List of detected ghost dependencies
 * @param zombies List of detected zombie dependencies
 * @param duplicates List of detected duplicate dependencies
 * @param drifts List of detected version drift issues
 * @param customPenalties Optional custom penalty configuration override
 * @returns Fully computed HealthScore object
 */
export function calculateHealthScore(
  ghosts: GhostDependency[],
  zombies: ZombieDependency[],
  duplicates: DuplicateDependency[],
  drifts: VersionDrift[],
  customPenalties?: ScanOptions['penalties']
): HealthScore {
  const deductions: HealthDeduction[] = [];
  let score = 100;

  // 1. Ghost Dependencies deduction
  if (ghosts.length > 0) {
    const penaltyPerGhost = customPenalties?.ghost ?? 5;
    const penalty = ghosts.length * penaltyPerGhost;
    deductions.push({
      reason: `${ghosts.length} ghost dependenc${ghosts.length === 1 ? 'y' : 'ies'} detected`,
      penalty,
    });
    score -= penalty;
  }

  // 2. Zombie Dependencies deduction
  if (zombies.length > 0) {
    const penaltyPerZombie = customPenalties?.zombie ?? 5;
    const penalty = zombies.length * penaltyPerZombie;
    deductions.push({
      reason: `${zombies.length} zombie dependenc${zombies.length === 1 ? 'y' : 'ies'} detected`,
      penalty,
    });
    score -= penalty;
  }

  // 3. Duplicate Dependencies deduction
  if (duplicates.length > 0) {
    const penaltyPerDuplicate = customPenalties?.duplicate ?? 3;
    const penalty = duplicates.length * penaltyPerDuplicate;
    deductions.push({
      reason: `${duplicates.length} duplicate package${duplicates.length === 1 ? '' : 's'} detected`,
      penalty,
    });
    score -= penalty;
  }

  // 4. Version Drift deduction (aggregating major, minor, patch, and missing)
  if (drifts.length > 0) {
    let driftPenaltyTotal = 0;
    let majorCount = 0;
    let minorCount = 0;
    let patchCount = 0;
    let missingCount = 0;

    for (const drift of drifts) {
      if (drift.driftType === 'major') {
        driftPenaltyTotal += customPenalties?.driftMajor ?? 2;
        majorCount++;
      } else if (drift.driftType === 'minor') {
        driftPenaltyTotal += customPenalties?.driftMinor ?? 2;
        minorCount++;
      } else if (drift.driftType === 'patch') {
        driftPenaltyTotal += customPenalties?.driftPatch ?? 2;
        patchCount++;
      } else if (drift.driftType === 'missing') {
        driftPenaltyTotal += customPenalties?.missing ?? 2;
        missingCount++;
      }
    }

    if (driftPenaltyTotal > 0) {
      const details: string[] = [];
      if (majorCount > 0) details.push(`${majorCount} major`);
      if (minorCount > 0) details.push(`${minorCount} minor`);
      if (patchCount > 0) details.push(`${patchCount} patch`);
      if (missingCount > 0) details.push(`${missingCount} missing`);

      deductions.push({
        reason: `${drifts.length} version drift${drifts.length === 1 ? '' : 's'} (${details.join(', ')})`,
        penalty: driftPenaltyTotal,
      });
      score -= driftPenaltyTotal;
    }
  }

  // Limit score to a minimum of 0
  score = Math.max(0, score);

  // Grade Assignment
  let grade: HealthScore['grade'] = 'F';
  if (score >= 90) {
    grade = 'A';
  } else if (score >= 80) {
    grade = 'B';
  } else if (score >= 70) {
    grade = 'C';
  } else if (score >= 60) {
    grade = 'D';
  }

  return {
    score,
    grade,
    metrics: {
      ghosts: ghosts.length,
      zombies: zombies.length,
      duplicates: duplicates.length,
      drifts: drifts.length,
    },
    deductions,
  };
}
