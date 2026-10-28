import { clockLabel } from '../ui/format';
import { startOfWeek, todayKey, weekdayOf } from './consistency';
import { closedBy, dayPlan, weekShortfall } from './day';
import { SESSIONS } from './program';
import { activeRepair, appointedDaysLeft, lastChance } from './repair';
import type { AppState } from './state';

/**
 * What the home screen needs to say.
 *
 * The widget is not a dashboard. It answers one question, the same question the
 * alarm answers: what does today ask of me, and what does the week still owe?
 * Everything here is derived from the same ledger the app reads, so the widget
 * cannot congratulate a week the app would call short, and it cannot promise a
 * ten minute session that would not close the gap.
 *
 * Kept pure and free of React so the headless widget task, the app and the
 * tests all compute the same sentence.
 */
export type WidgetTone = 'ink' | 'rust' | 'moss';

export interface WidgetAction {
  label: string;
  /** A deep link the widget opens without waking the React tree first. */
  uri: string;
}

export interface WidgetModel {
  mode:
    | 'sign'
    | 'train'
    | 'short'
    | 'repair'
    | 'booked'
    | 'written'
    | 'skipped'
    | 'whole'
    | 'rest';
  /** Top right. A fact about the week, never a streak. */
  count: string;
  headline: string;
  detail: string;
  action: WidgetAction | null;
  secondary: WidgetAction | null;
  tone: WidgetTone;
  /** The count turns rust only when the week is actually behind. */
  countTone: WidgetTone;
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

const HOME: WidgetAction = { label: 'OPEN THE PAGE', uri: 'ledger:///' };

function dayLabel(day: string): string {
  return WEEKDAYS[weekdayOf(day)]!;
}

function stamp(day: string, hour: number, minute: number): string {
  return `${dayLabel(day)} ${clockLabel(hour, minute)}`;
}

/** Today, not "tonight", because a 7am appointment is still today. */
function daypart(hour: number): string {
  if (hour >= 17) return 'Tonight';
  if (hour >= 12) return 'This afternoon';
  if (hour >= 5) return 'This morning';
  return 'Today';
}

/**
 * Pages written this week, counted from the entries themselves rather than from
 * a consistency snapshot that may have been computed on a different day. The
 * widget can be rendered at 00:01 by a launcher; it should not still be
 * counting last week's pages.
 */
function pagesThisWeek(state: AppState, today: string): number {
  const start = startOfWeek(today);
  const trained = new Set(
    state.entries
      .filter(
        (entry) =>
          entry.day >= start &&
          entry.day <= today &&
          (entry.kind === 'full' || entry.kind === 'floor'),
      )
      .map((entry) => entry.day),
  );
  return trained.size;
}

export function widgetModel(state: AppState, now: Date = new Date()): WidgetModel {
  const today = todayKey(now);
  const contract = state.contract;
  const target = state.consistency.weekTarget || 3;

  if (!contract) {
    return {
      mode: 'sign',
      count: 'THREE A WEEK',
      headline: 'The appointment.',
      detail: 'Three pages a week. One page each session.',
      action: { label: 'WRITE THE CONTRACT', uri: 'ledger:///onboarding' },
      secondary: null,
      tone: 'ink',
      countTone: 'ink',
    };
  }

  const pages = pagesThisWeek(state, today);
  const count = `${pages} / ${target} PAGES`;
  const plan = dayPlan(state, today, now);
  const repair = activeRepair(state, today);

  /**
   * A booked repair outranks the gap that caused it. The user has already made
   * the plan; repeating "one page short" every time they unlock the phone would
   * be billing them for a debt they have scheduled to pay.
   */
  if (repair && repair.day === today) {
    return {
      mode: 'repair',
      count,
      headline: 'Ten minutes.',
      detail: `Today, ${clockLabel(repair.hour, repair.minute)}. The page you skipped.`,
      action: { label: 'START THE REPAIR', uri: 'ledger:///session?kind=floor' },
      /** The whole card still opens the ledger; a second label would crowd it. */
      secondary: null,
      tone: 'rust',
      countTone: 'rust',
    };
  }

  if (repair && repair.day > today) {
    return {
      mode: 'booked',
      count,
      headline: 'Repair booked.',
      detail: `${stamp(repair.day, repair.hour, repair.minute)} · one floor session.`,
      action: null,
      secondary: HOME,
      tone: 'rust',
      countTone: 'rust',
    };
  }

  /** The last day the week can still be saved turns the widget into the offer. */
  if (lastChance(state, today)) {
    return {
      mode: 'short',
      count,
      headline: 'One page short.',
      detail: 'Ten minutes closes the week.',
      action: { label: 'TEN MINUTES', uri: 'ledger:///session?kind=floor' },
      secondary: { label: 'FULL SESSION', uri: 'ledger:///session?kind=full' },
      tone: 'rust',
      countTone: 'rust',
    };
  }

  if (plan.kind === 'train' || plan.kind === 'makeup') {
    const session = SESSIONS[plan.key];
    const movements = session.movementIds.length;
    const short = plan.kind === 'makeup' && plan.missed > 0;

    /**
     * The appointment is a time, not a mood. Once it has gone by, saying
     * "Tonight, 19:00" would be a claim about the future that is already false.
     * The app's fallback alarm fires ninety minutes later; after that, the
     * shortest version leads, because the weakest hour should cost one tap.
     */
    const appointment = contract.hour * 60 + contract.minute;
    const fallback = appointment + 90;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const afterAppointment = plan.kind === 'train' && nowMinutes >= appointment;
    const afterFallback =
      afterAppointment && fallback <= 24 * 60 && nowMinutes >= fallback;

    if (afterFallback) {
      return {
        mode: 'train',
        count,
        headline: 'Ten minutes.',
        detail: 'The appointment has passed. Ten minutes still counts.',
        action: { label: 'TEN MINUTES', uri: 'ledger:///session?kind=floor' },
        secondary: { label: 'FULL SESSION', uri: 'ledger:///session?kind=full' },
        tone: 'rust',
        countTone: 'rust',
      };
    }

    return {
      mode: short ? 'short' : 'train',
      count,
      headline: short
        ? `${plan.missed} page${plan.missed === 1 ? '' : 's'} short.`
        : plan.because === 'first'
          ? 'The first page.'
          : afterAppointment
            ? 'The page is still blank.'
            : `${daypart(contract.hour)}, ${clockLabel(contract.hour, contract.minute)}`,
      detail: short
        ? 'One session closes the gap.'
        : afterAppointment
          ? `The ${clockLabel(contract.hour, contract.minute)} appointment has passed.`
          : `Session ${plan.key} · ${movements} movements`,
      action: {
        label: short ? 'START THE SESSION' : 'START SESSION',
        uri: 'ledger:///session?kind=full',
      },
      secondary: { label: 'TEN MINUTES', uri: 'ledger:///session?kind=floor' },
      tone: short || afterAppointment ? 'rust' : 'ink',
      countTone: short || afterAppointment ? 'rust' : 'ink',
    };
  }

  if (pages >= target) {
    return {
      mode: 'whole',
      count,
      headline: 'The week is whole.',
      detail: `${target} pages written. Nothing owed.`,
      action: null,
      secondary: HOME,
      tone: 'moss',
      countTone: 'moss',
    };
  }

  if (plan.because === 'closed') {
    const behind = weekShortfall(state, contract.days, today);
    /**
     * Today is closed, but the week is already beyond saving: no appointment
     * is left and the shortfall survives whatever was written today. The widget
     * says so once, plainly, and offers no tap that cannot change it.
     */
    const lost = appointedDaysLeft(state, today) === 0 && behind > 0;
    const closed = closedBy(state, today);

    /**
     * A skip closes the day and keeps its price, but it is not a page. Saying
     * "Written" here would be the one lie the whole ledger exists to avoid.
     */
    if (closed === 'skip') {
      const protectedSkip = state.entries.some(
        (entry) => entry.day === today && entry.kind === 'skip-protected',
      );
      return {
        mode: 'skipped',
        count,
        headline: lost ? 'The week closed short.' : protectedSkip ? 'Token spent.' : 'Skipped.',
        detail: lost
          ? 'The skip is written. No appointment is left to make it whole.'
          : plan.nextDay
            ? `The skip is written. Next page ${stamp(plan.nextDay, contract.hour, contract.minute)}`
            : 'The skip is written. The next page is not set.',
        action: null,
        secondary: HOME,
        tone: 'rust',
        countTone: behind > 0 ? 'rust' : 'ink',
      };
    }

    if (lost) {
      return {
        mode: 'short',
        count,
        headline: 'The week closed short.',
        detail: 'The page is written. No appointment is left to make it whole.',
        action: null,
        secondary: HOME,
        tone: 'rust',
        countTone: 'rust',
      };
    }
    return {
      mode: 'written',
      count,
      headline: 'Written.',
      detail: plan.nextDay
        ? `Next page ${stamp(plan.nextDay, contract.hour, contract.minute)}`
        : 'The next page is not set.',
      action: null,
      secondary: HOME,
      tone: 'ink',
      countTone: 'ink',
    };
  }

  if (plan.because === 'recovery') {
    const ready = new Date(now.getTime() + plan.hoursUntilReady * 3_600_000);
    return {
      mode: 'rest',
      count,
      headline: 'Nothing to lift.',
      detail: `The page opens at ${clockLabel(ready.getHours(), ready.getMinutes())}`,
      action: null,
      secondary: HOME,
      tone: 'ink',
      countTone: 'ink',
    };
  }

  return {
    mode: 'rest',
    count,
    headline: 'Nothing to lift.',
    detail: plan.nextDay
      ? `Next page ${stamp(plan.nextDay, contract.hour, contract.minute)}`
      : 'The next page is not set.',
    action: null,
    secondary: HOME,
    tone: 'ink',
    countTone: 'ink',
  };
}
