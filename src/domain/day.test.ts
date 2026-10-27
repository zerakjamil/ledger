import { describe, expect, test } from 'bun:test';
import { dayPlan } from './day';
import { reduceEvents, type AppEvent, type Contract } from './state';

const contract: Contract = {
  days: [1, 3, 5],
  hour: 19,
  minute: 0,
  ifText: 'when it is 7pm I put on shoes',
  reward: 'one chapter',
  stake: 'twenty to the jar',
  createdAt: '2026-10-01T18:00:00.000Z',
};

const signed = (createdAt = contract.createdAt): AppEvent => ({
  type: 'contract.set',
  at: createdAt,
  day: createdAt.slice(0, 10),
  payload: { ...contract, createdAt } as unknown as Record<string, unknown>,
});

const finish = (day: string, key: 'A' | 'B' | 'C' = 'A'): AppEvent => ({
  type: 'session.finish',
  at: `${day}T19:00:00.000Z`,
  day,
  payload: { key, kind: 'full', results: {} },
});

const skip = (day: string): AppEvent => ({
  type: 'skip',
  at: `${day}T19:00:00.000Z`,
  day,
  payload: { reason: 'work', protected: true },
});

const sunday = '2026-10-25';
const sundayNoon = new Date('2026-10-25T12:00:00.000Z');

describe('what today is for', () => {
  test('the first session is offered on any day at all', () => {
    const state = reduceEvents([signed()]);
    const plan = dayPlan(state, sunday, sundayNoon);
    expect(plan.kind).toBe('train');
    expect(plan.because).toBe('first');
    expect(plan.key).toBe('A');
    /** Three appointments went by unwritten since the contract was signed. */
    expect(plan.missed).toBe(3);
  });

  test('an appointed day is a training day', () => {
    const state = reduceEvents([signed(), finish('2026-10-23', 'C')]);
    const plan = dayPlan(state, '2026-10-26', new Date('2026-10-26T12:00:00.000Z'));
    expect(plan.kind).toBe('train');
    expect(plan.because).toBe('appointed');
    expect(plan.key).toBe('A');
  });

  test('Monday morning does not reach back into the week that just ended', () => {
    const state = reduceEvents([signed(), finish('2026-10-23', 'C')]);
    const plan = dayPlan(state, '2026-10-26', new Date('2026-10-26T12:00:00.000Z'));
    /** Last week ended two pages short; this week has not missed anything yet. */
    expect(plan.missed).toBe(0);
  });

  test('a Sunday with two unwritten appointments offers one make-up', () => {
    const state = reduceEvents([signed(), finish('2026-10-23', 'C')]);
    const plan = dayPlan(state, sunday, sundayNoon);
    expect(plan.kind).toBe('makeup');
    expect(plan.missed).toBe(2);
  });

  test('a session on another day absorbs a missed appointment', () => {
    const state = reduceEvents([signed(), finish('2026-10-20', 'A')]);
    const plan = dayPlan(state, '2026-10-22', new Date('2026-10-22T12:00:00.000Z'));
    expect(plan.kind).toBe('makeup');
    expect(plan.missed).toBe(1);
  });

  test('a skip gives the run a pass but does not write the page', () => {
    const state = reduceEvents([signed(), skip('2026-10-19')]);
    const plan = dayPlan(state, '2026-10-20', new Date('2026-10-20T12:00:00.000Z'));
    expect(plan.missed).toBe(1);
  });

  test('a floor session later in the week closes the gap', () => {
    const state = reduceEvents([signed(), finish('2026-10-21', 'B')]);
    const plan = dayPlan(state, '2026-10-23', new Date('2026-10-23T12:00:00.000Z'));
    /** Two appointments went by (Mon, Wed) and one page was written. */
    expect(plan.missed).toBe(1);
  });

  test('nothing owed and nothing appointed is a rest day with a next page', () => {
    const state = reduceEvents([
      signed(),
      finish('2026-10-19', 'A'),
      finish('2026-10-21', 'B'),
      finish('2026-10-23', 'C'),
    ]);
    const plan = dayPlan(state, sunday, sundayNoon);
    expect(plan.kind).toBe('rest');
    expect(plan.because).toBe('none');
    expect(plan.nextDay).toBe('2026-10-26');
  });

  test('days before the signature are never counted as misses', () => {
    const state = reduceEvents([
      signed('2026-10-21T09:00:00.000Z'),
      finish('2026-10-21', 'A'),
    ]);
    const plan = dayPlan(state, '2026-10-23', new Date('2026-10-23T18:00:00.000Z'));
    expect(plan.because).toBe('appointed');
    expect(plan.missed).toBe(0);
  });

  test('twenty hours is a floor, not an opinion', () => {
    const state = reduceEvents([signed(), finish('2026-10-25', 'A')]);
    const plan = dayPlan(state, '2026-10-26', new Date('2026-10-26T06:00:00.000Z'));
    expect(plan.kind).toBe('rest');
    expect(plan.because).toBe('recovery');
    expect(plan.key).toBe('B');
    expect(plan.hoursUntilReady).toBe(9);
  });

  test('a session written today closes the page, even on an appointed day', () => {
    const state = reduceEvents([signed(), finish('2026-10-26', 'A')]);
    const plan = dayPlan(state, '2026-10-26', new Date('2026-10-26T21:00:00.000Z'));
    expect(plan.kind).toBe('rest');
    expect(plan.because).toBe('closed');
    /** Wednesday, not today: the next appointment is strictly ahead. */
    expect(plan.nextDay).toBe('2026-10-28');
    expect(plan.key).toBe('B');
  });

  test('a skip on day zero closes the day before any session exists', () => {
    const state = reduceEvents([signed(), skip(sunday)]);
    const plan = dayPlan(state, sunday, sundayNoon);
    expect(plan.kind).toBe('rest');
    expect(plan.because).toBe('closed');
    expect(plan.nextDay).toBe('2026-10-26');
    expect(plan.key).toBe('A');
  });

  test('a written skip is answered, but it is still not a page', () => {
    const state = reduceEvents([
      signed(),
      skip('2026-10-19'),
      finish('2026-10-21', 'B'),
      finish('2026-10-23', 'C'),
    ]);
    const plan = dayPlan(state, sunday, sundayNoon);
    expect(plan.kind).toBe('makeup');
    expect(plan.missed).toBe(1);
  });
});
