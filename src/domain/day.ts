import { addDays, startOfWeek, todayKey, weekdayOf } from './consistency';
import { nextSession } from './rotation';
import type { AppState } from './state';
import type { SessionKey } from './types';

export type DayPlanKind = 'train' | 'makeup' | 'rest';

export type DayPlanBecause = 'first' | 'appointed' | 'backlog' | 'recovery' | 'closed' | 'none';

export interface DayPlan {
  kind: DayPlanKind;
  /** The session on offer, or the next one when the page is resting. */
  key: SessionKey;
  because: DayPlanBecause;
  /**
   * Pages the week is short, after sessions on other days are allowed to
   * absorb a missed appointment. Three pages is the promise, not three dates.
   */
  missed: number;
  /** Only meaningful when kind is 'rest'. */
  nextDay: string | null;
  hoursUntilReady: number;
}

/**
 * What today is actually for.
 *
 * The contract names the appointments, the rotation names the session. Those
 * are two different facts, and collapsing them is what makes gym apps nag on a
 * Sunday. A day is a training day if it was appointed, or if something
 * appointed earlier in the week was missed and the body has had its twenty
 * hours. Anything else is a rest day, and the page says so without apology.
 */
export function dayPlan(state: AppState, today = todayKey(), now = new Date()): DayPlan {
  const contractDays = state.contract?.days ?? [1, 3, 5];
  const last = state.records.length > 0 ? state.records[state.records.length - 1]! : null;
  const next = nextSession(last, now);

  /**
   * A page that already has something written on it is closed, and a closed day
   * is a rest day even when the contract called it a training day. Otherwise the
   * app would keep offering a second session until midnight.
   */
  const closedToday = state.entries.some(
    (entry) =>
      entry.day === today &&
      (entry.kind === 'full' ||
        entry.kind === 'floor' ||
        entry.kind === 'skip' ||
        entry.kind === 'skip-protected'),
  );

  const appointed = contractDays.includes(weekdayOf(today));
  const missed = shortfallBefore(state, contractDays, today);

  if (closedToday) {
    return {
      kind: 'rest',
      key: next.key,
      because: 'closed',
      missed,
      nextDay: upcomingAfter(today, contractDays),
      hoursUntilReady: 0,
    };
  }

  if (!last) {
    return {
      kind: 'train',
      key: next.key,
      because: 'first',
      missed,
      nextDay: null,
      hoursUntilReady: 0,
    };
  }

  if (next.kind === 'rest') {
    return {
      kind: 'rest',
      key: next.key,
      because: 'recovery',
      missed,
      /** The floor clears today, so today is still the day the page opens. */
      nextDay: appointed ? today : upcoming(today, contractDays),
      hoursUntilReady: next.hoursUntilReady,
    };
  }

  const nextDay = appointed ? today : upcoming(today, contractDays);

  if (appointed) {
    return { kind: 'train', key: next.key, because: 'appointed', missed, nextDay, hoursUntilReady: 0 };
  }

  if (missed > 0) {
    return { kind: 'makeup', key: next.key, because: 'backlog', missed, nextDay, hoursUntilReady: 0 };
  }

  return { kind: 'rest', key: next.key, because: 'none', missed: 0, nextDay, hoursUntilReady: 0 };
}

/**
 * Pages the week is behind through `throughDay`, inclusive.
 *
 * The contract promises three pages a week, so the honest measure is pace: the
 * appointments that have gone by through the day in question, minus the days
 * that were actually trained. A session on Tuesday absorbs a blank Monday
 * because the page was still written that week. A skip does not absorb
 * anything: a token keeps the run and covers the price, but it is not a page.
 *
 * Inclusive is the right shape for the question "if today ends unwritten, how
 * short is the week?" The day plan asks the same question about yesterday, and
 * `shortfallBefore` keeps that call from reaching into the week that just ended.
 */
export function weekShortfall(
  state: AppState,
  contractDays: readonly number[],
  throughDay: string,
): number {
  const signedOn = state.contract?.createdAt.slice(0, 10) ?? throughDay;
  const start = startOfWeek(throughDay);
  const end = addDays(start, 6);
  const through = throughDay < end ? throughDay : end;

  let due = 0;
  for (let i = 0; i < 7; i += 1) {
    const day = addDays(start, i);
    if (day > through) break;
    if (day < signedOn) continue;
    if (contractDays.includes(weekdayOf(day))) due += 1;
  }

  const trained = new Set(
    state.entries
      .filter(
        (entry) =>
          entry.day >= start &&
          entry.day <= through &&
          entry.day >= signedOn &&
          (entry.kind === 'full' || entry.kind === 'floor'),
      )
      .map((entry) => entry.day),
  ).size;

  return Math.max(0, due - trained);
}

/**
 * How short the week was before today. On Monday the week has no past yet, so
 * the answer is zero without asking `weekShortfall` about yesterday, which
 * belongs to the week that just ended.
 */
function shortfallBefore(
  state: AppState,
  contractDays: readonly number[],
  day: string,
): number {
  if (day === startOfWeek(day)) return 0;
  return weekShortfall(state, contractDays, addDays(day, -1));
}
/** The next appointed day, strictly after today. */
function upcomingAfter(today: string, contractDays: readonly number[]): string {
  for (let i = 1; i < 9; i += 1) {
    const day = addDays(today, i);
    if (contractDays.includes(weekdayOf(day))) return day;
  }
  return today;
}

/** The next appointed day, today or later. */
function upcoming(today: string, contractDays: readonly number[]): string {
  for (let i = 0; i < 8; i += 1) {
    const day = addDays(today, i);
    if (contractDays.includes(weekdayOf(day))) return day;
  }
  return today;
}
