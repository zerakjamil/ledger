import { describe, expect, test } from 'bun:test';
import { CATALOG } from './catalog';
import { movementById, PROGRAM_SLOTS } from './library';
import { reduceEvents, slotTarget, type AppEvent } from './state';
import type { SetResult } from './types';

const day = '2026-10-19';
const ev = (
  type: AppEvent['type'],
  payload: Record<string, unknown>,
  at = `${day}T19:00:00.000Z`,
): AppEvent => ({
  type,
  payload,
  at,
  day: at.slice(0, 10),
});

const sets = (reps: number, count: number, rir = 2, loadKg = 15): SetResult[] =>
  Array.from({ length: count }, () => ({ reps, loadKg, rir }));

const GOBLET = CATALOG.find((record) => record.name === 'Dumbbell goblet squat')!.id;

describe('a slot can hold a shelf movement', () => {
  test('the plan starts with all eleven slots pointing at themselves', () => {
    const state = reduceEvents([]);
    expect(PROGRAM_SLOTS).toHaveLength(11);
    for (const slot of PROGRAM_SLOTS) expect(slotTarget(state, slot.id)).toBe(slot.id);
  });

  test('taking a slot resolves everywhere and seeds its own prescription', () => {
    const state = reduceEvents([ev('slot.set', { slot: 'split-squat', movementId: GOBLET })]);
    expect(state.slots['split-squat']).toBe(GOBLET);
    expect(slotTarget(state, 'split-squat')).toBe(GOBLET);
    expect(movementById(GOBLET)?.name).toBe('Dumbbell goblet squat');

    const seeded = state.prescriptions[GOBLET]!.prescription;
    expect(seeded).toEqual({ movementId: GOBLET, loadKg: 15, sets: 3, target: 8, stage: 0 });
    /** The original keeps its own numbers, untouched, for the day it comes back. */
    expect(state.prescriptions['split-squat']!.prescription).toEqual(
      reduceEvents([]).prescriptions['split-squat']!.prescription,
    );
  });

  test('putting the original back keeps the numbers it never lost', () => {
    const state = reduceEvents([
      ev('slot.set', { slot: 'split-squat', movementId: GOBLET }, `${day}T18:00:00.000Z`),
      ev('slot.set', { slot: 'split-squat', movementId: 'split-squat' }, `${day}T20:00:00.000Z`),
    ]);
    expect(slotTarget(state, 'split-squat')).toBe('split-squat');
    expect(state.prescriptions['split-squat']!.prescription).toEqual(
      reduceEvents([]).prescriptions['split-squat']!.prescription,
    );
  });

  test('a finished session advances the movement in the slot, not the original', () => {
    const state = reduceEvents([
      ev('slot.set', { slot: 'split-squat', movementId: GOBLET }, `${day}T18:00:00.000Z`),
      ev(
        'session.finish',
        { key: 'A', kind: 'full', results: { [GOBLET]: sets(9, 3) } },
        `${day}T19:00:00.000Z`,
      ),
    ]);
    expect(state.prescriptions[GOBLET]!.prescription.target).toBe(9);
    expect(state.prescriptions['split-squat']!.prescription.target).toBe(8);
    expect(state.lastResults[GOBLET]).toHaveLength(3);
  });

  test('a rack movement cannot take a slot, even through the event log', () => {
    const rack = CATALOG.find((record) => record.needsRack)!;
    const state = reduceEvents([ev('slot.set', { slot: 'db-bench', movementId: rack.id })]);
    expect(slotTarget(state, 'db-bench')).toBe('db-bench');
    expect(state.prescriptions[rack.id]).toBe(undefined);
  });

  test('an unknown slot or movement changes nothing', () => {
    const state = reduceEvents([
      ev('slot.set', { slot: 'not-a-slot', movementId: GOBLET }),
      ev('slot.set', { slot: 'split-squat', movementId: 'not-a-movement' }),
    ]);
    expect(state.slots).toEqual({});
  });

  test('the slot log replays the same way out of order', () => {
    const events = [
      ev('slot.set', { slot: 'split-squat', movementId: GOBLET }, `${day}T18:00:00.000Z`),
      ev(
        'session.finish',
        { key: 'A', kind: 'full', results: { [GOBLET]: sets(9, 3) } },
        `${day}T19:00:00.000Z`,
      ),
      ev('slot.set', { slot: 'split-squat', movementId: 'split-squat' }, `${day}T20:00:00.000Z`),
    ];
    expect(JSON.stringify(reduceEvents(events))).toBe(
      JSON.stringify(reduceEvents([...events].reverse())),
    );
  });
});
