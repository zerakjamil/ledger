import { loadsFor, nextLoad, previousLoad } from './equipment';
import type {
  Equipment,
  ProgressionInput,
  ProgressionOutput,
  ProgressionReason,
  SetResult,
} from './types';

/**
 * A load jump bigger than this is not progress, it is a new exercise. With 5 kg
 * plate pairs on a 10 kg bar the smallest barbell step is 10 kg, which is 100%
 * of an empty bar, so the engine must refuse it and climb the rep and set
 * levers instead.
 */
const MAX_LOAD_JUMP = 0.1;

export function advance(input: ProgressionInput, eq: Equipment): ProgressionOutput {
  const { movement, prev, results, stalls } = input;
  const step = movement.unit === 'seconds' ? 5 : 1;
  const [bottom, top] = movement.range;
  const hold = (reason: ProgressionReason, nextStalls = stalls): ProgressionOutput => ({
    next: prev,
    stalls: nextStalls,
    reason,
  });

  if (results.length === 0) return hold('no-data');
  if (results.length < prev.sets) return hold('hold-partial');

  const missed = results.some((r) => r.reps < prev.target);
  if (missed) {
    if (stalls + 1 >= 2) return deload(input, eq);
    return hold('hold-missed', stalls + 1);
  }

  const minRir = Math.min(...results.map((r) => r.rir));
  if (minRir < 1) return hold('hold-effort', 0);

  if (prev.target + step <= top) {
    return {
      next: { ...prev, target: prev.target + step },
      stalls: 0,
      reason: 'add-rep',
    };
  }

  const loads = loadsFor(movement.loading, eq);
  const candidate = nextLoad(prev.loadKg, loads);
  const jumpOk =
    candidate !== null && candidate - prev.loadKg <= Math.max(prev.loadKg * MAX_LOAD_JUMP, 2.5);

  if (candidate !== null && jumpOk) {
    return {
      next: { ...prev, loadKg: candidate, target: bottom },
      stalls: 0,
      reason: 'add-load',
    };
  }

  if (prev.sets < movement.maxSets) {
    return {
      next: { ...prev, sets: prev.sets + 1, target: bottom },
      stalls: 0,
      reason: 'add-set',
    };
  }

  if (prev.stage < movement.levers.length - 1) {
    return {
      next: { ...prev, stage: prev.stage + 1, target: bottom },
      stalls: 0,
      reason: 'escalate',
    };
  }

  return { next: prev, stalls: 0, reason: 'maxed' };
}

function deload(input: ProgressionInput, eq: Equipment): ProgressionOutput {
  const { movement, prev } = input;
  const loads = loadsFor(movement.loading, eq);
  const lighter = previousLoad(prev.loadKg, loads);
  const [bottom] = movement.range;
  const step = movement.unit === 'seconds' ? 5 : 1;

  if (lighter !== null) {
    return {
      next: { ...prev, loadKg: lighter, stage: 0, target: bottom },
      stalls: 0,
      reason: 'deload',
    };
  }
  return {
    next: { ...prev, target: Math.max(bottom, prev.target - step), stage: 0 },
    stalls: 0,
    reason: 'deload',
  };
}

/** Read-only summary the session screen shows after the last set. */
export function summarise(results: readonly SetResult[]): {
  sets: number;
  reps: number;
  avgRir: number;
} {
  if (results.length === 0) return { sets: 0, reps: 0, avgRir: 0 };
  const reps = results.reduce((sum, r) => sum + r.reps, 0);
  const rir = results.reduce((sum, r) => sum + r.rir, 0);
  return {
    sets: results.length,
    reps,
    avgRir: Math.round((rir / results.length) * 10) / 10,
  };
}
