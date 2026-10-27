import type { Equipment, Loading, Movement } from './types';

/**
 * Every bar weight that can physically be built from the plates in the room.
 * A prescription outside this set is a bug, not a preference.
 */
export function barbellLoads(eq: Equipment): number[] {
  const perSide: number[] = [0];
  for (const plate of eq.platePairsKg) {
    if (plate <= 0) continue;
    const snapshot = [...perSide];
    for (const base of snapshot) perSide.push(base + plate);
  }
  const loads = new Set<number>();
  for (const side of perSide) {
    const total = eq.barKg + side * 2;
    if (eq.maxLoadKg !== undefined && total > eq.maxLoadKg) continue;
    loads.add(round(total));
  }
  return [...loads].sort((a, b) => a - b);
}

export function dumbbellLoads(eq: Equipment): number[] {
  const loads = eq.dumbbellsKg.filter((kg) => kg > 0).map(round);
  return [...new Set(loads)].sort((a, b) => a - b);
}

export function loadsFor(loading: Loading, eq: Equipment): number[] {
  if (loading.kind === 'barbell') return barbellLoads(eq);
  if (loading.kind === 'dumbbell') return dumbbellLoads(eq);
  return [];
}

export function nextLoad(current: number, loads: readonly number[]): number | null {
  for (const load of loads) if (load > current) return load;
  return null;
}

export function previousLoad(current: number, loads: readonly number[]): number | null {
  let found: number | null = null;
  for (const load of loads) {
    if (load < current) found = load;
    else break;
  }
  return found;
}

export function heaviestLoad(loads: readonly number[]): number {
  return loads.length === 0 ? 0 : loads[loads.length - 1]!;
}

export function describeLoad(movement: Movement, loadKg: number): string {
  if (movement.loading.kind === 'bodyweight') return 'bodyweight';
  if (movement.loading.kind === 'dumbbell' && movement.loading.hands === 2) {
    return `${formatKg(loadKg)} kg each`;
  }
  return `${formatKg(loadKg)} kg`;
}

export function formatKg(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : kg.toFixed(2).replace(/0$/, '');
}

function round(kg: number): number {
  return Math.round(kg * 100) / 100;
}

/** The default kit measured on day 0: 10 kg bar plus 5/2.5/1.25 pairs. */
export const HOME_KIT: Equipment = {
  barKg: 10,
  platePairsKg: [5, 2.5, 1.25],
  dumbbellsKg: [15],
  maxLoadKg: 30,
};
