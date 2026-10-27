import { describe, expect, test } from 'bun:test';
import { reduceEvents, type AppEvent } from './state';
import { weekView } from './week';

const contract: AppEvent = {
  type: 'contract.set',
  at: '2026-10-01T18:00:00.000Z',
  day: '2026-10-01',
  payload: {
    days: [1, 3, 5],
    hour: 19,
    minute: 0,
    ifText: 'when it is 7pm I put on shoes',
    reward: 'one chapter',
    stake: 'twenty to the jar',
    createdAt: '2026-10-01T18:00:00.000Z',
  },
};

const at = (day: string, type: AppEvent['type'], payload: Record<string, unknown>): AppEvent => ({
  type,
  payload,
  at: `${day}T19:00:00.000Z`,
  day,
});

describe('the week strip', () => {
  test('Monday first, planned days outlined, unplanned days blank', () => {
    const state = reduceEvents([contract]);
    const week = weekView(state, '2026-10-21');
    expect(week.map((c) => c.label)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    expect(week[0]!.state).toBe('missed');
    expect(week[1]!.state).toBe('rest');
    expect(week[2]!.state).toBe('today');
    expect(week[4]!.state).toBe('planned');
    expect(week[6]!.state).toBe('rest');
  });

  test('a session and a floor session both fill their day, with different marks', () => {
    const state = reduceEvents([
      contract,
      at('2026-10-19', 'session.finish', { key: 'A', kind: 'full', results: {} }),
      at('2026-10-21', 'session.finish', { key: 'B', kind: 'floor', results: {} }),
    ]);
    const week = weekView(state, '2026-10-23');
    expect(week[0]!.state).toBe('done');
    expect(week[2]!.state).toBe('floor');
  });

  test('a protected skip still reads as a skip, never as a session', () => {
    const state = reduceEvents([
      contract,
      at('2026-10-19', 'skip', { reason: 'sick', protected: true }),
    ]);
    const week = weekView(state, '2026-10-20');
    expect(week[0]!.state).toBe('skip');
    expect(week[0]!.state).not.toBe('done');
  });
});

describe('the week before the contract', () => {
  test('days that passed before the signature are blank, not missed', () => {
    const late: AppEvent = {
      ...contract,
      at: '2026-10-22T19:00:00.000Z',
      day: '2026-10-22',
      payload: { ...(contract.payload as object), createdAt: '2026-10-22T19:00:00.000Z' } as Record<string, unknown>,
    };
    const state = reduceEvents([late]);
    const week = weekView(state, '2026-10-23');
    expect(week.slice(0, 4).map((cell) => cell.state)).toEqual(['rest', 'rest', 'rest', 'rest']);
    expect(week[4]!.state).toBe('today');
    expect(week[5]!.state).toBe('rest');
  });
});
