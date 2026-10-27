import { describe, expect, test } from 'bun:test';
import { debts } from './debt';
import { reduceEvents, type AppEvent, type Contract } from './state';

const contract: Contract = {
  days: [1, 3, 5],
  hour: 19,
  minute: 0,
  ifText: 'when it is 7pm I put on shoes',
  reward: 'one chapter',
  stake: 'twenty to the jar',
  createdAt: '2026-10-05T18:00:00.000Z',
};

const signed: AppEvent = {
  type: 'contract.set',
  at: contract.createdAt,
  day: '2026-10-05',
  payload: { ...contract, createdAt: contract.createdAt } as unknown as Record<string, unknown>,
};

const finish = (day: string): AppEvent => ({
  type: 'session.finish',
  at: `${day}T19:00:00.000Z`,
  day,
  payload: { key: 'A', kind: 'full', results: {} },
});

const skip = (day: string, protectedSkip: boolean): AppEvent => ({
  type: 'skip',
  at: `${day}T19:00:00.000Z`,
  day,
  payload: { reason: 'work', protected: protectedSkip },
});

describe('what the stake applies to', () => {
  test('a fresh contract owes nothing before the first appointment', () => {
    const state = reduceEvents([signed]);
    expect(debts(state, '2026-10-05').total).toBe(0);
  });

  test('an appointment with silence is a debt, an answered one is not', () => {
    const state = reduceEvents([signed, finish('2026-10-07')]);
    const owed = debts(state, '2026-10-10');
    expect(owed.noShows).toEqual(['2026-10-05', '2026-10-09']);
    expect(owed.total).toBe(2);
  });

  test('a token keeps the day off the stake, an open skip does not', () => {
    const state = reduceEvents([
      signed,
      skip('2026-10-05', true),
      skip('2026-10-07', false),
      finish('2026-10-09'),
    ]);
    const owed = debts(state, '2026-10-10');
    expect(owed.noShows).toEqual([]);
    expect(owed.written).toBe(1);
    expect(owed.total).toBe(1);
  });

  test('a session the next morning clears the alarm and the debt', () => {
    const state = reduceEvents([signed, finish('2026-10-06')]);
    const owed = debts(state, '2026-10-07');
    expect(owed.noShows).toEqual([]);
    expect(owed.total).toBe(0);
  });

  test('the repair counts on the day it happens, not the day after', () => {
    const state = reduceEvents([signed, finish('2026-10-06')]);
    expect(debts(state, '2026-10-06').total).toBe(0);
  });

  test('a written skip stays on the ledger even after the page is made up', () => {
    const state = reduceEvents([signed, skip('2026-10-05', false), finish('2026-10-06')]);
    const owed = debts(state, '2026-10-07');
    expect(owed.noShows).toEqual([]);
    expect(owed.written).toBe(1);
    expect(owed.total).toBe(1);
  });

  test('appointments before the contract was signed cannot be missed', () => {
    const late = { ...contract, createdAt: '2026-10-08T18:00:00.000Z' };
    const signedLate: AppEvent = {
      type: 'contract.set',
      at: late.createdAt,
      day: '2026-10-08',
      payload: { ...late, createdAt: late.createdAt } as unknown as Record<string, unknown>,
    };
    const owed = debts(reduceEvents([signedLate]), '2026-10-10');
    expect(owed.noShows).toEqual(['2026-10-09']);
    expect(owed.total).toBe(1);
  });

  test('the same day is never counted twice', () => {
    const state = reduceEvents([signed, skip('2026-10-05', false), finish('2026-10-05')]);
    expect(debts(state, '2026-10-06').total).toBe(0);
  });
});
