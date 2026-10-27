import { describe, expect, test } from 'bun:test';
import { HOME_KIT, barbellLoads } from './equipment';
import { advance } from './progression';
import { MOVEMENTS } from './program';
import type { Movement, Prescription, ProgressionInput, SetResult } from './types';

const splitSquat = MOVEMENTS['split-squat']!;
const ohp = MOVEMENTS['barbell-ohp']!;
const pushup = MOVEMENTS['pushup-feet']!;

function prescription(overrides: Partial<Prescription> = {}): Prescription {
  return {
    movementId: 'split-squat',
    loadKg: 15,
    sets: 3,
    target: 8,
    stage: 0,
    ...overrides,
  };
}

function sets(reps: number, count = 3, rir = 2, loadKg = 15): SetResult[] {
  return Array.from({ length: count }, () => ({ reps, loadKg, rir }));
}

function run(
  movement: Movement,
  prev: Prescription,
  results: SetResult[],
  stalls = 0,
): ReturnType<typeof advance> {
  const input: ProgressionInput = { movement, prev, results, stalls };
  return advance(input, HOME_KIT);
}

describe('progression', () => {
  test('a missed target never adds load', () => {
    const out = run(splitSquat, prescription({ target: 10, loadKg: 15 }), sets(8));
    expect(out.reason).toBe('hold-missed');
    expect(out.next.loadKg).toBe(15);
    expect(out.next.target).toBe(10);
  });

  test('two consecutive misses deload, dropping reps when there is no lighter dumbbell', () => {
    const out = run(splitSquat, prescription({ target: 10, loadKg: 15 }), sets(8), 1);
    expect(out.reason).toBe('deload');
    expect(out.next.target).toBe(9);
    expect(out.next.stage).toBe(0);
  });

  test('two consecutive misses on the bar drop the load, not just the reps', () => {
    const prev = prescription({ movementId: 'barbell-ohp', loadKg: 25, target: 10 });
    const out = run(ohp, prev, sets(8, 3, 1, 25), 1);
    expect(out.reason).toBe('deload');
    expect(out.next.loadKg).toBe(22.5);
    expect(out.next.target).toBe(8);
  });

  test('hitting the top of the window at real effort adds a rep first', () => {
    const out = run(splitSquat, prescription({ target: 9 }), sets(9));
    expect(out.reason).toBe('add-rep');
    expect(out.next.target).toBe(10);
    expect(out.next.loadKg).toBe(15);
  });

  test('effort below RIR 1 holds instead of progressing', () => {
    const out = run(splitSquat, prescription({ target: 9 }), sets(10, 3, 0));
    expect(out.reason).toBe('hold-effort');
    expect(out.next.target).toBe(9);
  });

  test('a partial session holds, it does not count as a full one', () => {
    const out = run(splitSquat, prescription({ sets: 4, target: 8 }), sets(8, 2));
    expect(out.reason).toBe('hold-partial');
  });

  test('a 100 percent jump from only-5 kg pairs is refused, sets climb instead', () => {
    const coarse = { ...HOME_KIT, platePairsKg: [5] };
    expect(barbellLoads(coarse)).toEqual([10, 20]);
    const prev = prescription({ movementId: 'barbell-ohp', loadKg: 10, target: 12, sets: 3 });
    const out = advance(
      { movement: ohp, prev, results: sets(12, 3, 2, 10), stalls: 0 },
      coarse,
    );
    expect(out.reason).toBe('add-set');
    expect(out.next.loadKg).toBe(10);
    expect(out.next.sets).toBe(4);
  });

  test('a 2.5 kg micro-jump is allowed once the bar is heavy enough', () => {
    const prev = prescription({ movementId: 'barbell-ohp', loadKg: 10, target: 12, sets: 3 });
    const out = run(ohp, prev, sets(12, 3, 2, 10));
    expect(out.reason).toBe('add-load');
    expect(out.next.loadKg).toBe(12.5);
  });

  test('a small enough jump does add load', () => {
    const heavy = prescription({ movementId: 'barbell-ohp', loadKg: 25, target: 12 });
    const out = run(ohp, heavy, sets(12, 3, 2, 25));
    expect(out.reason).toBe('add-load');
    expect(out.next.loadKg).toBe(27.5);
    expect(out.next.target).toBe(8);
  });

  test('bodyweight work escalates through its levers after sets are maxed', () => {
    const prev = prescription({ movementId: 'pushup-feet', loadKg: 0, target: 15, sets: 4 });
    const out = run(pushup, prev, sets(15, 4, 2, 0));
    expect(out.reason).toBe('escalate');
    expect(out.next.stage).toBe(1);
    expect(out.next.target).toBe(6);
  });

  test('nothing left to add reports maxed instead of inventing a load', () => {
    const prev = prescription({
      movementId: 'pushup-feet',
      loadKg: 0,
      target: 15,
      sets: 4,
      stage: pushup.levers.length - 1,
    });
    const out = run(pushup, prev, sets(15, 4, 2, 0));
    expect(out.reason).toBe('maxed');
    expect(out.next).toEqual(prev);
  });

  test('same input gives the same output and never mutates the previous prescription', () => {
    const prev = prescription({ target: 9 });
    const before = JSON.stringify(prev);
    const a = run(splitSquat, prev, sets(9));
    const b = run(splitSquat, prev, sets(9));
    expect(a).toEqual(b);
    expect(JSON.stringify(prev)).toBe(before);
  });
});

describe('invariants over random histories', () => {
  test('loads stay buildable and targets stay in the window for a thousand steps', () => {
    let seed = 42;
    const rand = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    const buildable = new Set(barbellLoads(HOME_KIT));

    for (const movement of Object.values(MOVEMENTS)) {
      let prev = prescription({
        movementId: movement.id,
        loadKg: movement.loading.kind === 'barbell' ? HOME_KIT.barKg : 15,
        target: movement.range[0],
        sets: movement.startSets,
      });
      let stalls = 0;

      for (let i = 0; i < 250; i += 1) {
        const reps = Math.max(1, prev.target - 3 + Math.floor(rand() * 7));
        const rir = Math.floor(rand() * 4);
        const results = Array.from({ length: prev.sets }, () => ({
          reps,
          loadKg: prev.loadKg,
          rir,
        }));
        const out = advance({ movement, prev, results, stalls }, HOME_KIT);
        stalls = out.stalls;

        expect(out.next.target).toBeGreaterThanOrEqual(movement.range[0]);
        expect(out.next.target).toBeLessThanOrEqual(movement.range[1]);
        expect(out.next.sets).toBeGreaterThanOrEqual(movement.startSets);
        expect(out.next.sets).toBeLessThanOrEqual(movement.maxSets);
        expect(out.next.stage).toBeLessThanOrEqual(movement.levers.length - 1);
        if (movement.loading.kind === 'barbell') {
          expect(buildable.has(out.next.loadKg)).toBe(true);
        }
        if (results.some((r) => r.reps < prev.target)) {
          expect(out.next.loadKg).toBeLessThanOrEqual(prev.loadKg);
        }
        prev = out.next;
      }
    }
  });
});
