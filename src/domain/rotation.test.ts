import { describe, expect, test } from 'bun:test';
import { nextSession } from './rotation';
import type { SessionRecord } from './types';

const at = (iso: string) => new Date(iso);

describe('rotation', () => {
  test('a fresh ledger starts at A', () => {
    expect(nextSession(null, at('2026-10-25T18:00:00Z')).key).toBe('A');
  });

  test('sessions rotate A, B, C regardless of the weekday', () => {
    const now = at('2026-10-28T18:00:00Z');
    const a: SessionRecord = { key: 'A', at: '2026-10-27T18:00:00Z', day: '2026-10-27', kind: 'full' };
    const b: SessionRecord = { key: 'B', at: '2026-10-25T18:00:00Z', day: '2026-10-25', kind: 'full' };
    expect(nextSession(a, now).key).toBe('B');
    expect(nextSession(b, now).key).toBe('C');
  });

  test('less than 20 hours after the last session is a rest day, not discipline', () => {
    const last: SessionRecord = { key: 'A', at: '2026-10-27T18:00:00Z', day: '2026-10-27', kind: 'full' };
    const result = nextSession(last, at('2026-10-28T06:00:00Z'));
    expect(result.kind).toBe('rest');
    expect(result.hoursUntilReady).toBe(8);
    expect(result.key).toBe('B');
  });

  test('at 20 hours the next session unlocks', () => {
    const last: SessionRecord = { key: 'A', at: '2026-10-27T18:00:00Z', day: '2026-10-27', kind: 'full' };
    expect(nextSession(last, at('2026-10-28T14:00:00Z')).kind).toBe('next');
  });
});
