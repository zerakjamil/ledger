import { addDays, startOfWeek, todayKey, weekdayOf } from './consistency';
import type { AppState } from './state';

export type WeekCellState = 'done' | 'floor' | 'skip' | 'missed' | 'today' | 'planned' | 'rest';

export interface WeekCell {
  day: string;
  /** Single letter, Monday first. */
  label: string;
  state: WeekCellState;
}

const LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

/**
 * The week as seven cells. A planned day in the past with nothing written on it
 * is the only honest way to show a miss, so that is what gets the rust outline.
 */
export function weekView(state: AppState, today = todayKey()): WeekCell[] {
  const start = startOfWeek(today);
  const planned = state.contract?.days ?? [1, 3, 5];
  /** Nothing can be missed before the contract existed. */
  const signedOn = state.contract?.createdAt.slice(0, 10) ?? null;

  const written = new Map<string, 'full' | 'floor' | 'skip'>();
  for (const entry of state.entries) {
    if (entry.kind === 'full') written.set(entry.day, 'full');
    else if (entry.kind === 'floor') written.set(entry.day, written.get(entry.day) ?? 'floor');
    else if (entry.kind === 'skip' || entry.kind === 'skip-protected') {
      if (!written.has(entry.day)) written.set(entry.day, 'skip');
    }
  }

  return LABELS.map((label, index) => {
    const day = addDays(start, index);
    if (signedOn !== null && day < signedOn) return { day, label, state: 'rest' as const };
    const mark = written.get(day);
    if (mark === 'full') return { day, label, state: 'done' as const };
    if (mark === 'floor') return { day, label, state: 'floor' as const };
    if (mark === 'skip') return { day, label, state: 'skip' as const };
    if (day === today) return { day, label, state: 'today' as const };
    if (day > today) {
      return {
        day,
        label,
        state: planned.includes(weekdayOf(day)) ? ('planned' as const) : ('rest' as const),
      };
    }
    return {
      day,
      label,
      state: planned.includes(weekdayOf(day)) ? ('missed' as const) : ('rest' as const),
    };
  });
}
