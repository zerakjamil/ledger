import { addDays, todayKey, weekdayOf } from './consistency';
import { noShowDays } from './debt';

export interface NotificationPrefs {
  /** Local hour the training appointment sits at. */
  anchorHour: number;
  anchorMinute: number;
  /** 0 = Sunday, matching Date.getDay(). */
  trainingDays: readonly number[];
  reviewDay: number;
  reviewHour: number;
}

export type NotificationKind = 'anchor' | 'fallback' | 'review' | 'debt' | 'repair';

export interface NotificationSpec {
  /** Stable, so re-planning replaces instead of duplicating. */
  id: string;
  kind: NotificationKind;
  at: Date;
  title: string;
  body: string;
  data: { route: string; kind: NotificationKind };
}

export interface PlanInput {
  now: Date;
  prefs: NotificationPrefs;
  /** True when today is already answered: a session, a floor session, or a written skip. */
  closedToday?: boolean;
  /** Every day with a line. A closed day cancels its own morning-after alarm. */
  writtenDays?: readonly string[];
  /** Every day with a session, which is what repairs a blank appointment. */
  trainedDays?: readonly string[];
  /** Skip days. A skip on a training day is written but still not a page. */
  skipDays?: readonly string[];
  /** The price the user wrote for an unexplained skip, verbatim. */
  stake?: string;
  /** The day the contract was signed. Appointments before it cannot be missed. */
  since?: string;
  /** The next session, rendered as the first anchor's body. */
  brief?: { text: string } | null;
  /** A booked ten minute repair. It is a commitment, not a debt. */
  repair?: { day: string; hour: number; minute: number } | null;
  horizonDays?: number;
  /** iOS keeps 64 pending; stay below it. */
  maxPending?: number;
}

/**
 * Every line is true at the moment it lands. The anchor fires on the
 * appointment, not before it, so nothing here counts down to a time that has
 * already arrived.
 */
const ANCHOR_COPY: readonly [string, string][] = [
  ['Set 1 is due', 'Shoes on. The bar is already where you left it.'],
  ['Ten minutes counts', 'Three movements, three sets. That is the whole promise.'],
  ['You do not need to feel like it', 'Start set 1. The wanting arrives afterwards.'],
];

const FALLBACK_COPY: readonly [string, string][] = [
  ['Still on the table', 'The short version is ten minutes. It still counts.'],
  ['The day is not gone yet', 'Do the floor session. Show up, log it, done.'],
];

/**
 * Local calendar triggers, planned forward in a rolling window. Pure so the
 * whole schedule can be proven in a test instead of guessed on a phone.
 */
export function planNotifications(input: PlanInput): NotificationSpec[] {
  const {
    now,
    prefs,
    closedToday = false,
    writtenDays = [],
    trainedDays = [],
    skipDays = [],
    stake,
    since,
    brief = null,
    repair = null,
    horizonDays = 7,
    maxPending = 60,
  } = input;
  const today = todayKey(now);
  const written = new Set(writtenDays);
  const trained = new Set(trainedDays);
  /** Cancellation is about evidence, and both a session and a skip are evidence. */
  const closed = new Set([...written, ...trained]);
  const writtenSkips = new Set(skipDays.filter((day) => !trained.has(day))).size;
  const price = stake?.trim() ? stake.trim() : null;
  const specs: NotificationSpec[] = [];
  let briefUsed = false;

  /**
   * Start at yesterday, not today. A missed appointment's alarm fires at 08:00
   * the next morning, and the app may well be opened at 2am that morning. A
   * planner that only looks forward would lose that alarm for good.
   */
  for (let offset = -1; offset < horizonDays; offset += 1) {
    const day = addDays(today, offset);
    if (!prefs.trainingDays.includes(weekdayOf(day))) continue;
    if (offset === 0 && closedToday) continue;

    const anchor = atLocal(day, prefs.anchorHour, prefs.anchorMinute);
    if (anchor.getTime() > now.getTime() + 30_000) {
      const [title, generic] = ANCHOR_COPY[offset % ANCHOR_COPY.length]!;
      const body = brief && !briefUsed ? brief.text : generic;
      if (brief && !briefUsed) briefUsed = true;
      specs.push({
        id: `anchor-${day}`,
        kind: 'anchor',
        at: anchor,
        title,
        body,
        data: { route: '/', kind: 'anchor' },
      });
    }

    const fallback = new Date(anchor.getTime() + 90 * 60_000);
    if (fallback.getTime() > now.getTime() + 30_000) {
      const [title, body] = FALLBACK_COPY[offset % FALLBACK_COPY.length]!;
      specs.push({
        id: `fallback-${day}`,
        kind: 'fallback',
        at: fallback,
        title,
        body,
        /** The weakest moment of the day gets the shortest path: one tap to the ten minute version. */
        data: { route: '/session?kind=floor', kind: 'fallback' },
      });
    }

    /**
     * The morning after. This is the only reminder whose cancel condition is
     * evidence rather than a tap: if a line was written for the day, the alarm
     * never existed. If the phone was ignored, it arrives before the next
     * appointment and before the week can quietly end.
     */
    const morning = addDays(day, 1);
    /**
     * If the morning the alarm would land on is already written, the alarm is
     * moot. Training at 6am is the repair; the 8am reminder would be a lie.
     */
    if (day >= (since ?? '0000-01-01') && !closed.has(day) && !closed.has(morning)) {
      const debtAt = atLocal(morning, 8, 0);
      if (debtAt.getTime() > now.getTime() + 30_000) {
        const previous = previousTrainingDay(day, prefs.trainingDays);
        /**
         * The alarm is planned before it fires, and if the user never opens the
         * app the queue is never rebuilt. A count taken today would be a lie by
         * tomorrow, so project the whole ledger onto the morning the alarm
         * lands. This is the same repair-aware ledger the log uses, which is
         * how the title and the count can never drift apart. A session rebuilds
         * the queue and resets the guess.
         */
        const projected = since
          ? noShowDays(
              { since, trainingDays: prefs.trainingDays, written, trained },
              morning,
            )
          : [];
        const owed = projected.length + writtenSkips;
        const count = owed > 0 ? ` ${owed} ${owed === 1 ? 'page' : 'pages'} unpaid.` : '';
        /** "Two in a row" only when the previous appointment is genuinely unpaid. */
        const repeat = previous !== null && projected.includes(previous);
        specs.push({
          id: `debt-${day}`,
          kind: 'debt',
          at: debtAt,
          title: repeat ? 'Never miss twice' : 'Yesterday went unwritten',
          body: repeat
            ? `Two appointments in a row.${count}${price ? ` ${price}` : ' Ten minutes now, or the week is gone.'}`
            : `Ten minutes still counts.${count}${price ? ` ${price}` : ''}`,
          /** The alarm promises ten minutes, so it opens the ten minute page. */
          data: { route: '/session?kind=floor', kind: 'debt' },
        });
      }
    }
  }

  /**
   * The repair the user booked at the moment of a skip. It is a one off, and it
   * only exists while the ledger still believes one session closes the week.
   * The alarm opens the floor session, so the promise and the work are one tap
   * apart, exactly like the morning-after alarm.
   */
  if (repair && !prefs.trainingDays.includes(weekdayOf(repair.day)) && !closed.has(repair.day)) {
    const at = atLocal(repair.day, repair.hour, repair.minute);
    if (at.getTime() > now.getTime() + 30_000) {
      specs.push({
        id: `repair-${repair.day}`,
        kind: 'repair',
        at,
        title: 'The page you skipped',
        body: 'Ten minutes now closes the week. One session, then it is whole.',
        data: { route: '/session?kind=floor', kind: 'repair' },
      });
    }
  }

  const reviewDay = nextWeekdayOnOrAfter(today, prefs.reviewDay);
  const reviewAt = atLocal(reviewDay, prefs.reviewHour, 0);
  if (reviewAt.getTime() > now.getTime()) {
    specs.push({
      id: `review-${reviewDay}`,
      kind: 'review',
      at: reviewAt,
      title: 'Three minutes, one number',
      body: 'Waist, weight average, sessions done. Then one change for next week.',
      data: { route: '/review', kind: 'review' },
    });
  }

  specs.sort((a, b) => a.at.getTime() - b.at.getTime());
  return dedupe(specs).slice(0, maxPending);
}

/** Cancels the fallback once a session starts, so the phone goes quiet. */
export function cancelAfterStart(
  specs: readonly NotificationSpec[],
  startedAt: Date,
): NotificationSpec[] {
  return specs.filter(
    (s) =>
      (s.kind !== 'fallback' && s.kind !== 'repair') ||
      s.at.getTime() < startedAt.getTime(),
  );
}

function dedupe(specs: readonly NotificationSpec[]): NotificationSpec[] {
  const seen = new Set<string>();
  const out: NotificationSpec[] = [];
  for (const spec of specs) {
    if (seen.has(spec.id)) continue;
    seen.add(spec.id);
    out.push(spec);
  }
  return out;
}

function previousTrainingDay(day: string, trainingDays: readonly number[]): string | null {
  for (let i = 1; i <= 7; i += 1) {
    const candidate = addDays(day, -i);
    if (trainingDays.includes(weekdayOf(candidate))) return candidate;
  }
  return null;
}

function nextWeekdayOnOrAfter(day: string, weekday: number): string {
  for (let i = 0; i < 7; i += 1) {
    const candidate = addDays(day, i);
    if (weekdayOf(candidate) === weekday) return candidate;
  }
  return day;
}

function atLocal(day: string, hour: number, minute: number): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, hour, minute, 0, 0);
}
