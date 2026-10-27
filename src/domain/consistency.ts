export type EntryKind = 'full' | 'floor' | 'skip-protected' | 'skip' | 'rest';

export interface DayEntry {
  /** Local calendar day, YYYY-MM-DD. */
  day: string;
  kind: EntryKind;
  reason?: string;
}

export interface Consistency {
  /** Sessions in a row without an unexplained skip. A rest day never breaks it. */
  run: number;
  /** Lifetime days that counted. */
  daysShown: number;
  sessionsThisWeek: number;
  weekTarget: number;
  /** Consecutive completed weeks at or above the target. */
  weeksOnTarget: number;
  tokensLeft: number;
  lastSkipReason: string | null;
}

export function computeConsistency(
  entries: readonly DayEntry[],
  today: string,
  weekTarget = 3,
  tokensPerMonth = 2,
): Consistency {
  const sorted = [...entries].sort((a, b) => a.day.localeCompare(b.day));

  /**
   * A page is a day. Two sessions in one day (a floor session after a full one,
   * say) are still one page, and counting both would let a single day fill the
   * whole week. The strongest thing written that day is what the page remembers.
   */
  const byDay = new Map<string, DayEntry>();
  const weight: Record<DayEntry['kind'], number> = {
    full: 3,
    floor: 2,
    'skip-protected': 1,
    skip: 0,
    rest: 0,
  };
  for (const entry of sorted) {
    const prior = byDay.get(entry.day);
    if (!prior || weight[entry.kind] > weight[prior.kind]) byDay.set(entry.day, entry);
  }
  const days = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));

  let run = 0;
  let daysShown = 0;
  for (const entry of days) {
    if (entry.kind === 'full' || entry.kind === 'floor') {
      run += 1;
      daysShown += 1;
    } else if (entry.kind === 'skip') {
      run = 0;
    }
  }

  const weekStart = startOfWeek(today);
  const sessionsThisWeek = days.filter(
    (e) => e.day >= weekStart && e.day <= today && (e.kind === 'full' || e.kind === 'floor'),
  ).length;

  let weeksOnTarget = 0;
  let cursor = addDays(weekStart, -7);
  for (let i = 0; i < 52; i += 1) {
    const count = countWeek(days, cursor);
    if (count < weekTarget) break;
    weeksOnTarget += 1;
    cursor = addDays(cursor, -7);
  }

  const month = today.slice(0, 7);
  const usedTokens = sorted.filter(
    (e) => e.day.slice(0, 7) === month && e.kind === 'skip-protected',
  ).length;

  const skips = sorted.filter((e) => e.kind === 'skip' || e.kind === 'skip-protected');
  const lastSkipReason = skips.length > 0 ? (skips[skips.length - 1]!.reason ?? null) : null;

  return {
    run,
    daysShown,
    sessionsThisWeek,
    weekTarget,
    weeksOnTarget,
    tokensLeft: Math.max(0, tokensPerMonth - usedTokens),
    lastSkipReason,
  };
}

function countWeek(entries: readonly DayEntry[], weekStart: string): number {
  const end = addDays(weekStart, 7);
  return entries.filter(
    (e) => e.day >= weekStart && e.day < end && (e.kind === 'full' || e.kind === 'floor'),
  ).length;
}

export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);
}

export function parseDay(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

export function addDays(day: string, days: number): string {
  const d = parseDay(day);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday-based week start. */
export function startOfWeek(day: string): string {
  const d = parseDay(day);
  const weekday = d.getUTCDay();
  const back = weekday === 0 ? 6 : weekday - 1;
  return addDays(day, -back);
}

/** 0 = Sunday, matching Date.getDay(). */
export function weekdayOf(day: string): number {
  return parseDay(day).getUTCDay();
}
