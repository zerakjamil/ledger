import { addDays, startOfWeek, todayKey, weekdayOf } from './consistency';
import type { AppState } from './state';

export interface Debts {
  /** Appointment days that were never answered and never made up, oldest first. */
  noShows: string[];
  /** Days the user did open the app and admit the skip, without a token. */
  written: number;
  /** What the stake applies to. */
  total: number;
}

export interface LedgerDays {
  /** The day the contract was signed. Appointments before it cannot be missed. */
  since: string;
  trainingDays: readonly number[];
  /** Every day with a line: a session or a skip. */
  written: ReadonlySet<string>;
  /** Days with a session behind them, which is what repairs a blank. */
  trained: ReadonlySet<string>;
}

/**
 * The appointments that were never answered, up to and including `through`.
 *
 * A ledger that only counts the skips the user confessed to flatters them: the
 * most common way to miss a session is to never open the app. This counts the
 * appointment, not the confession.
 *
 * A session on another day in the same week buys a blank back, oldest blank
 * first. That is what the morning alarm promises with "ten minutes clears it",
 * and a promise the ledger immediately contradicts is worse than no alarm at
 * all. A written skip is different: it was a decision with a price attached,
 * and making the page up later does not unmake the decision.
 *
 * `through` is the day the question is asked about. An appointment on that day
 * is not overdue yet, so it is not counted; a session on that day still counts
 * as a repair, because training this morning is exactly the repair the alarm
 * asked for.
 */
export function noShowDays(ledger: LedgerDays, through: string): string[] {
  const { since, trainingDays, written, trained } = ledger;
  const noShows: string[] = [];

  let weekStart = startOfWeek(since);
  for (let week = 0; week < 260 && weekStart <= through; week += 1) {
    const weekEnd = addDays(weekStart, 7);
    /** Past weeks are complete; the current week stops at the day in question. */
    const cutoff = weekEnd <= through ? weekEnd : through;

    const blank: string[] = [];
    let repairs = 0;
    for (let i = 0; i < 7; i += 1) {
      const day = addDays(weekStart, i);
      if (day > cutoff) break;
      if (day < since) continue;
      if (trainingDays.includes(weekdayOf(day))) {
        /** Today's appointment is not overdue yet, so it cannot be blank. */
        if (day < cutoff && !written.has(day)) blank.push(day);
      } else if (trained.has(day)) {
        /** A session today is exactly the repair the alarm asked for. */
        repairs += 1;
      }
    }

    /** Oldest blank first: the freshest debt is the one still worth chasing. */
    noShows.push(...blank.slice(repairs));
    weekStart = weekEnd;
  }

  return noShows;
}

/**
 * What the stake applies to, today.
 *
 * One day is one page, and the strongest line wins: a skip written in the
 * morning and a session trained in the evening is a training day, not a debt.
 */
export function debts(state: AppState, today = todayKey()): Debts {
  const contract = state.contract;
  if (!contract) return { noShows: [], written: 0, total: 0 };

  const writtenDays = new Set(state.entries.map((entry) => entry.day));
  const trainedDays = new Set(
    state.entries
      .filter((entry) => entry.kind === 'full' || entry.kind === 'floor')
      .map((entry) => entry.day),
  );

  const noShows = noShowDays(
    {
      since: contract.createdAt.slice(0, 10),
      trainingDays: contract.days,
      written: writtenDays,
      trained: trainedDays,
    },
    today,
  );

  const written = new Set(
    state.entries
      .filter((entry) => entry.kind === 'skip' && !trainedDays.has(entry.day))
      .map((entry) => entry.day),
  ).size;

  return { noShows, written, total: noShows.length + written };
}
