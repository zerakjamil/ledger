import { describe, expect, test } from 'bun:test';
import { MOVEMENTS } from './program';
import { reduceEvents, waistTrend, weightTrend } from './state';
import type { AppEvent } from './state';
import type { SetResult } from './types';

const day = '2026-10-19';
const ev = (type: AppEvent['type'], payload: Record<string, unknown>, at = `${day}T19:00:00.000Z`): AppEvent => ({
  type,
  payload,
  at,
  day: at.slice(0, 10),
});

const sets = (reps: number, count: number, rir = 2, loadKg = 15): SetResult[] =>
  Array.from({ length: count }, () => ({ reps, loadKg, rir }));

describe('event log reducer', () => {
  test('an empty log still yields a usable starting plan', () => {
    const state = reduceEvents([]);
    expect(state.contract).toBeNull();
    expect(Object.keys(state.prescriptions)).toHaveLength(Object.keys(MOVEMENTS).length);
    expect(state.prescriptions['split-squat']!.prescription.loadKg).toBe(15);
  });

  test('a completed session moves prescriptions forward exactly once', () => {
    const finished = ev('session.finish', {
      key: 'A',
      kind: 'full',
      results: { 'split-squat': sets(9, 3) },
    });
    const once = reduceEvents([finished]);
    expect(once.prescriptions['split-squat']!.prescription.target).toBe(9);
    expect(once.prescriptions['split-squat']!.prescription.loadKg).toBe(15);
    expect(once.prescriptions['split-squat']!.lastReason).toBe('add-rep');
    expect(once.records).toHaveLength(1);
    expect(once.consistency.run).toBe(1);
  });

  test('replaying the same log twice gives byte identical state', () => {
    const events = [
      ev('contract.set', {
        days: [1, 3, 5],
        hour: 19,
        minute: 0,
        ifText: 'when it is 7pm I put on shoes',
        reward: 'one chapter',
        stake: 'twenty to the jar',
        createdAt: `${day}T18:00:00.000Z`,
      }),
      ev('session.finish', { key: 'A', kind: 'full', results: { 'split-squat': sets(12, 3) } }),
      ev('session.finish', {
        key: 'B',
        kind: 'floor',
        results: { 'barbell-ohp': sets(9, 3, 2, 10) },
      }, `${day}T20:00:00.000Z`),
    ];
    const a = reduceEvents(events);
    const b = reduceEvents([...events].reverse());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test('a protected skip keeps the run, an unprotected one breaks it', () => {
    const base = [ev('session.finish', { key: 'A', kind: 'full', results: {} })];
    const protectedState = reduceEvents([
      ...base,
      ev('skip', { reason: 'sick', protected: true }, '2026-10-20T20:00:00.000Z'),
    ]);
    const bareState = reduceEvents([
      ...base,
      ev('skip', { reason: 'work', protected: false }, '2026-10-20T20:00:00.000Z'),
    ]);
    expect(protectedState.consistency.run).toBe(1);
    expect(bareState.consistency.run).toBe(0);
  });

  test('a booked repair can be replaced and cancelled, and it writes no page', () => {
    const booked = ev('repair.book', { day: '2026-10-24', hour: 19, minute: 0 });
    const once = reduceEvents([booked]);
    expect(once.repair).toEqual({ bookedOn: day, day: '2026-10-24', hour: 19, minute: 0 });
    /** A plan is not evidence. Only a finished session writes a page. */
    expect(once.entries).toHaveLength(0);
    expect(once.consistency.daysShown).toBe(0);

    const replaced = reduceEvents([
      booked,
      ev('repair.book', { day: '2026-10-25', hour: 10, minute: 30 }, `${day}T20:00:00.000Z`),
    ]);
    expect(replaced.repair?.day).toBe('2026-10-25');
    expect(replaced.repair?.hour).toBe(10);
    expect(replaced.repair?.minute).toBe(30);

    const cancelled = reduceEvents([booked, ev('repair.cancel', {}, `${day}T20:00:00.000Z`)]);
    expect(cancelled.repair).toBeNull();
  });

  test('new plates change future load choices, never past prescriptions', () => {
    const session = (n: number): AppEvent => ({
      type: 'session.finish',
      payload: { key: 'B', kind: 'full', results: { 'barbell-ohp': sets(12, 3, 2, 10) } },
      at: `2026-10-${String(10 + n).padStart(2, '0')}T19:00:00.000Z`,
      day: `2026-10-${String(10 + n).padStart(2, '0')}`,
    });
    // Four sessions walk the rep target 8, 9, 10, 11, 12 with the coarse plates.
    const before = [session(0), session(1), session(2), session(3)];
    const coarse = reduceEvents(before);
    expect(coarse.prescriptions['barbell-ohp']!.prescription.target).toBe(12);
    expect(coarse.prescriptions['barbell-ohp']!.prescription.loadKg).toBe(10);

    const upgraded = reduceEvents([
      ...before,
      {
        type: 'equipment.set',
        payload: { barKg: 10, platePairsKg: [10, 5, 2.5, 1.25], dumbbellsKg: [15], maxLoadKg: 40 },
        at: '2026-10-15T18:00:00.000Z',
        day: '2026-10-15',
      },
      session(5),
    ]);
    expect(upgraded.equipment.platePairsKg).toEqual([10, 5, 2.5, 1.25]);
    expect(upgraded.prescriptions['barbell-ohp']!.prescription.loadKg).toBe(12.5);
    expect(upgraded.prescriptions['barbell-ohp']!.prescription.target).toBe(8);
  });

  test('weights and waists reduce to trends, not single readings', () => {
    const events: AppEvent[] = Array.from({ length: 14 }, (_, i) => {
      const date = `2026-10-${String(i + 1).padStart(2, '0')}`;
      return {
        type: 'weigh' as const,
        payload: { kg: 90 - i * 0.1 },
        at: `${date}T08:00:00.000Z`,
        day: date,
      };
    });
    const state = reduceEvents(events);
    const trend = weightTrend(state.weights);
    expect(trend.latest).not.toBeNull();
    expect(trend.slopePerWeek).toBeLessThan(0);

    const waist = waistTrend([
      { day: '2026-10-01', cm: 96 },
      { day: '2026-10-22', cm: 94.5 },
    ]);
    expect(waist.change).toBe(-1.5);
  });
});

describe('a session written after midnight', () => {
  test('belongs to the local day it was written, not the UTC day', () => {
    const state = reduceEvents([
      {
        type: 'session.finish',
        // 00:30 in a UTC+3 room is still the previous day in UTC.
        at: '2026-10-24T21:30:00.000Z',
        day: '2026-10-25',
        payload: { key: 'A', kind: 'full', results: {} },
      },
    ]);
    expect(state.records[0]!.day).toBe('2026-10-25');
    expect(state.records[0]!.at).toBe('2026-10-24T21:30:00.000Z');
  });
});

describe('the weekly target', () => {
  test('follows the days in the contract, not a hardcoded three', () => {
    const state = reduceEvents([
      {
        type: 'contract.set',
        at: '2026-10-01T18:00:00.000Z',
        day: '2026-10-01',
        payload: {
          days: [2, 5],
          hour: 19,
          minute: 0,
          ifText: 'when it is 7pm I put on shoes',
          reward: 'one chapter',
          stake: 'twenty to the jar',
          createdAt: '2026-10-01T18:00:00.000Z',
        },
      },
    ]);
    expect(state.consistency.weekTarget).toBe(2);
  });
});
