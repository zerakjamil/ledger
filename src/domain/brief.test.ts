import { describe, expect, test } from 'bun:test';
import { sessionBrief } from './brief';
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

const signed: AppEvent = {
  type: 'contract.set',
  at: contract.createdAt,
  day: contract.createdAt.slice(0, 10),
  payload: { ...contract, createdAt: contract.createdAt } as unknown as Record<string, unknown>,
};

const finish = (day: string, key: 'A' | 'B' | 'C'): AppEvent => ({
  type: 'session.finish',
  at: `${day}T19:00:00.000Z`,
  day,
  payload: { key, kind: 'full', results: {} },
});

const sundayNoon = new Date(2026, 9, 25, 12, 0, 0);

describe('the lock screen carries the page', () => {
  test('the first session names its first movement and its load', () => {
    const brief = sessionBrief(reduceEvents([signed]), sundayNoon);
    expect(brief).not.toBeNull();
    expect(brief!.key).toBe('A');
    expect(brief!.text.startsWith('Set 1 of A:')).toBe(true);
    expect(brief!.text).toContain('×');
    expect(brief!.text).toContain('kg');
  });

  test('the rotation moves the brief with it', () => {
    const state = reduceEvents([signed, finish('2026-10-23', 'A')]);
    expect(sessionBrief(state, sundayNoon)!.key).toBe('B');
  });
});
