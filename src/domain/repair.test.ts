import { describe, expect, test } from 'bun:test';
import { weekShortfall } from './day';
import { activeRepair, appointedDaysLeft, lastChance, repairOffer } from './repair';
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

const sign = (days = contract.days): AppEvent => ({
  type: 'contract.set',
  at: contract.createdAt,
  day: contract.createdAt.slice(0, 10),
  payload: { ...contract, days } as unknown as Record<string, unknown>,
});

const finish = (day: string, key: 'A' | 'B' | 'C' = 'A'): AppEvent => ({
  type: 'session.finish',
  at: `${day}T19:00:00.000Z`,
  day,
  payload: { key, kind: 'floor', results: {} },
});

const skip = (day: string): AppEvent => ({
  type: 'skip',
  at: `${day}T19:00:00.000Z`,
  day,
  payload: { reason: 'work', protected: false },
});

const book = (bookedOn: string, day: string, hour = 19, minute = 0): AppEvent => ({
  type: 'repair.book',
  at: `${bookedOn}T20:00:00.000Z`,
  day: bookedOn,
  payload: { day, hour, minute },
});

describe('the week one session can still save', () => {
  test('an offer only exists when no appointment is left and one page is missing', () => {
    const state = reduceEvents([sign(), finish('2026-11-03'), finish('2026-11-04')]);
    expect(weekShortfall(state, contract.days, '2026-11-06')).toBe(1);
    expect(repairOffer(state, '2026-11-06')).toEqual({ day: '2026-11-07', hour: 19, minute: 0 });
  });

  test('an appointment still ahead is the repair, so no extra session is offered', () => {
    const state = reduceEvents([sign(), finish('2026-11-03')]);
    expect(repairOffer(state, '2026-11-04')).toBeNull();
  });

  test('two pages short is not a promise one session can keep', () => {
    const state = reduceEvents([sign(), finish('2026-11-03')]);
    expect(repairOffer(state, '2026-11-06')).toBeNull();
  });

  test('a week already at target offers nothing', () => {
    const state = reduceEvents([
      sign(),
      finish('2026-11-02'),
      finish('2026-11-04'),
      finish('2026-11-06'),
    ]);
    expect(repairOffer(state, '2026-11-06')).toBeNull();
  });

  test('Saturday can book Sunday, because Sunday is the last page of the week', () => {
    const state = reduceEvents([sign(), finish('2026-11-03'), finish('2026-11-04')]);
    expect(repairOffer(state, '2026-11-07')).toEqual({ day: '2026-11-08', hour: 19, minute: 0 });
    expect(repairOffer(state, '2026-11-08')).toBeNull();
  });

  test('the floor session is first only when the week can still be whole', () => {
    const oneShort = reduceEvents([sign(), finish('2026-11-03'), finish('2026-11-04')]);
    expect(lastChance(oneShort, '2026-11-07')).toBe(true);
    expect(lastChance(oneShort, '2026-11-08')).toBe(true);
    /** Friday is appointed, so the normal session is the day, not a rescue. */
    expect(lastChance(oneShort, '2026-11-06')).toBe(false);
    const twoShort = reduceEvents([sign(), finish('2026-11-03')]);
    expect(lastChance(twoShort, '2026-11-07')).toBe(false);
  });

  test('the appointment count only looks forward', () => {
    const state = reduceEvents([sign()]);
    expect(appointedDaysLeft(state, '2026-11-04')).toBe(1);
    expect(appointedDaysLeft(state, '2026-11-06')).toBe(0);
    expect(appointedDaysLeft(state, '2026-11-07')).toBe(0);
  });

  test('the inclusive measure counts today; the normal plan counts yesterday', () => {
    const state = reduceEvents([sign(), finish('2026-11-03'), finish('2026-11-04')]);
    expect(weekShortfall(state, contract.days, '2026-11-02')).toBe(1);
    expect(weekShortfall(state, contract.days, '2026-11-04')).toBe(0);
    expect(weekShortfall(state, contract.days, '2026-11-06')).toBe(1);
  });
});

describe('a booked repair', () => {
  const base = [sign(), finish('2026-11-03'), finish('2026-11-04')];

  test('stays live until its page is written', () => {
    const state = reduceEvents([...base, book('2026-11-06', '2026-11-07')]);
    expect(activeRepair(state, '2026-11-06')?.day).toBe('2026-11-07');
    expect(activeRepair(state, '2026-11-07')?.day).toBe('2026-11-07');
  });

  test('a session on the booked day closes it', () => {
    const state = reduceEvents([
      ...base,
      book('2026-11-06', '2026-11-07'),
      finish('2026-11-07'),
    ]);
    expect(activeRepair(state, '2026-11-07')).toBeNull();
    /** The session is the page, so the closed day measures as whole. */
    expect(weekShortfall(state, contract.days, '2026-11-07')).toBe(0);
  });

  test('a skip on the booked day closes it without writing a page', () => {
    const state = reduceEvents([
      ...base,
      book('2026-11-06', '2026-11-07'),
      skip('2026-11-07'),
    ]);
    expect(activeRepair(state, '2026-11-07')).toBeNull();
    expect(state.entries.some((entry) => entry.kind === 'skip')).toBe(true);
  });

  test('it expires after the day, and a second skip makes one session too few', () => {
    const after = reduceEvents([...base, book('2026-11-06', '2026-11-07')]);
    expect(activeRepair(after, '2026-11-08')).toBeNull();

    const twoShort = reduceEvents([
      sign(),
      finish('2026-11-03'),
      skip('2026-11-04'),
      book('2026-11-06', '2026-11-07'),
    ]);
    expect(activeRepair(twoShort, '2026-11-06')).toBeNull();
  });

  test('an appointment moved onto the repair day cancels it', () => {
    const saturdayContract = [sign([1, 3, 6]), finish('2026-11-03'), finish('2026-11-04')];
    const state = reduceEvents([...saturdayContract, book('2026-11-06', '2026-11-07')]);
    expect(activeRepair(state, '2026-11-06')).toBeNull();
  });
});
