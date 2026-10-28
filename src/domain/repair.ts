import { addDays, startOfWeek, todayKey, weekdayOf } from './consistency';
import { weekShortfall } from './day';
import type { AppState, RepairRecord } from './state';

export interface RepairOffer {
  /** The day the ten minutes are booked for. */
  day: string;
  hour: number;
  minute: number;
}

/** Contract days still ahead this week. Today is never included. */
export function appointedDaysLeft(state: AppState, today = todayKey()): number {
  const days = state.contract?.days ?? [];
  const end = addDays(startOfWeek(today), 6);
  let left = 0;
  for (let day = addDays(today, 1); day <= end; day = addDays(day, 1)) {
    if (days.includes(weekdayOf(day))) left += 1;
  }
  return left;
}

/**
 * The last ten minute session that can still make the week whole.
 *
 * A skip is a decision, but it is not the end of the week. When one page is all
 * that stands between the ledger and its target, and no appointment is left to
 * write it, the skip page offers the repair before it closes the day. The offer
 * is deliberately narrow: one page, one session, no appointment left. The app
 * never promises a whole week that one session cannot deliver.
 *
 * The page for today is presumed skipped when this is called from the skip
 * page, which is why the shortfall is measured through today.
 */
export function repairOffer(state: AppState, today = todayKey()): RepairOffer | null {
  const contract = state.contract;
  if (!contract) return null;
  if (weekShortfall(state, contract.days, today) !== 1) return null;
  if (appointedDaysLeft(state, today) > 0) return null;

  const end = addDays(startOfWeek(today), 6);
  if (today >= end) return null;

  const day = addDays(today, 1);
  if (contract.days.includes(weekdayOf(day))) return null;

  return { day, hour: contract.hour, minute: contract.minute };
}

/**
 * The day the ten minute version is not a shortcut but the only road left.
 *
 * True on a non-appointment day with one page missing and no appointment left
 * in the week. This is the day the home page puts the floor session first.
 */
export function lastChance(state: AppState, today = todayKey()): boolean {
  const contract = state.contract;
  if (!contract) return false;
  if (contract.days.includes(weekdayOf(today))) return false;
  /**
   * A closed day is closed. The ledger keeps one page per day, so a second
   * session cannot move the count, and the skip page already made the repair
   * offer before it wrote the skip. Re-offering it here would bill a decision
   * the user has already made.
   */
  if (state.entries.some((entry) => entry.day === today)) return false;
  if (weekShortfall(state, contract.days, today) !== 1) return false;
  return appointedDaysLeft(state, today) === 0;
}

/**
 * The repair the user booked, while it is still the thing that closes the week.
 *
 * It disappears when the page is written, when the booked day has passed, when
 * a later skip makes one session insufficient, or when the contract moves an
 * appointment onto the repair day. A reminder for a promise the ledger no
 * longer believes is worse than no reminder.
 */
export function activeRepair(state: AppState, today = todayKey()): RepairRecord | null {
  const repair = state.repair;
  const contract = state.contract;
  if (!repair || !contract) return null;
  if (repair.day < today) return null;
  if (startOfWeek(repair.day) !== startOfWeek(today)) return null;
  if (contract.days.includes(weekdayOf(repair.day))) return null;
  if (state.entries.some((entry) => entry.day === repair.day)) return null;
  if (weekShortfall(state, contract.days, today) !== 1) return null;
  return repair;
}
