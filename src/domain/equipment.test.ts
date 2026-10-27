import { describe, expect, test } from 'bun:test';
import { HOME_KIT, barbellLoads, describeLoad, nextLoad, previousLoad } from './equipment';
import type { Equipment } from './types';

describe('barbell loads', () => {
  test('every buildable weight is reachable and nothing above the ceiling leaks in', () => {
    const loads = barbellLoads(HOME_KIT);
    expect(loads[0]).toBe(10);
    expect(loads).toContain(12.5);
    expect(loads).toContain(27.5);
    expect(loads.every((l) => l <= 30)).toBe(true);
    expect(loads).toEqual([...loads].sort((a, b) => a - b));
  });

  test('a single pair of 5s leaves the bar with two usable weights, not three', () => {
    const eq: Equipment = { barKg: 10, platePairsKg: [5], dumbbellsKg: [15] };
    expect(barbellLoads(eq)).toEqual([10, 20]);
  });

  test('next and previous stay inside the plate reality', () => {
    const loads = barbellLoads(HOME_KIT);
    expect(nextLoad(10, loads)).toBe(12.5);
    expect(nextLoad(27.5, loads)).toBeNull();
    expect(previousLoad(12.5, loads)).toBe(10);
    expect(previousLoad(10, loads)).toBeNull();
  });
});

describe('load description', () => {
  test('dumbbell pairs read as two implements, barbells as one total', () => {
    const pair = {
      id: 'x',
      name: 'x',
      pattern: 'hpush' as const,
      unit: 'reps' as const,
      loading: { kind: 'dumbbell' as const, hands: 2 as const },
      range: [10, 15] as const,
      startSets: 3,
      maxSets: 4,
      rirTarget: 2,
      levers: ['a'],
    };
    expect(describeLoad(pair, 15)).toBe('15 kg each');
    expect(describeLoad({ ...pair, loading: { kind: 'dumbbell', hands: 1 } }, 15)).toBe('15 kg');
    expect(describeLoad({ ...pair, loading: { kind: 'barbell' } }, 27.5)).toBe('27.5 kg');
  });
});
