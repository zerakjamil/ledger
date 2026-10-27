export type AdviceKind =
  'hold' | 'add-steps' | 'eat-more' | 'move-anchor' | 'schedule' | 'collect' | 'floor';

export interface AdviceInput {
  sessionsThisWeek: number;
  weekTarget: number;
  run: number;
  weeksOnTarget: number;
  slopePerWeek: number | null;
  lastSkipReason: string | null;
  /** The weekly floor: steps and protein. Null when the question went unanswered. */
  floorKept: boolean | null;
  /** Days left including today. */
  daysLeftInWeek: number;
}

export interface Advice {
  kind: AdviceKind;
  title: string;
  body: string;
}

/**
 * Exactly one change per week. Two changes is a new program, and a new program
 * in week three is how people quit.
 */
export function weeklyAdvice(input: AdviceInput): Advice {
  const {
    sessionsThisWeek,
    weekTarget,
    weeksOnTarget,
    slopePerWeek,
    lastSkipReason,
    floorKept,
    daysLeftInWeek,
  } = input;

  if (sessionsThisWeek === 0 && daysLeftInWeek <= 2) {
    return {
      kind: 'schedule',
      title: daysLeftInWeek <= 1 ? 'One day left' : 'Two days left',
      body:
        daysLeftInWeek <= 1
          ? 'Ten minutes today still counts as showing up. That is the only goal left this week.'
          : 'Put the first session in the morning. Evening sessions are the ones that get eaten.',
    };
  }

  if (lastSkipReason && sessionsThisWeek < weekTarget) {
    return {
      kind: 'move-anchor',
      title: 'Move the anchor, not the willpower',
      body: `Your last skip said “${lastSkipReason}”. Change the time it happens, not the effort you promise.`,
    };
  }

  /**
   * The floor is the only part of the week the app cannot see for itself, so
   * asking the question and then ignoring the answer would make it decoration.
   * It outranks a request for more data, because it is a change the user has
   * already diagnosed. A week that hits its sessions and drops its steps is
   * exactly the week that ends in a flat scale and a mystery.
   */
  if (floorKept === false) {
    return {
      kind: 'floor',
      title: 'The floor slipped',
      body: 'The sessions are not the whole week. Eight thousand steps and 140 g protein is the part that decides whether the scale moves.',
    };
  }

  if (slopePerWeek === null) {
    return {
      kind: 'collect',
      title: 'Seven mornings before a verdict',
      body: 'Log weight daily for a week. One reading is water, seven is a trend.',
    };
  }

  if (slopePerWeek > -0.2) {
    return {
      kind: 'add-steps',
      title: 'The average is flat',
      body: 'Add fifteen hundred steps a day for one week. Do not touch the food yet.',
    };
  }

  if (slopePerWeek < -1.0) {
    return {
      kind: 'eat-more',
      title: 'Faster than a kilo a week',
      body: 'Add a proper portion at dinner. Losing strength to lose fat is the wrong trade.',
    };
  }

  if (weeksOnTarget >= 3) {
    return {
      kind: 'hold',
      title: 'Nothing to add',
      body: 'Three weeks on target. Change nothing. Boredom is the program working.',
    };
  }

  return {
    kind: 'hold',
    title: 'Hold everything',
    body: 'Same days, same weights, same food floor. One week of nothing new is progress.',
  };
}
