import { describe, expect, test } from 'bun:test';
import { computeConsistency, startOfWeek } from './consistency';
import type { DayEntry } from './consistency';

const e = (day: string, kind: DayEntry['kind'], reason?: string): DayEntry => ({ day, kind, reason });

describe('consistency', () => {
  test('a rest day never breaks the run', () => {
    const entries = [e('2026-10-19', 'full'), e('2026-10-20', 'rest'), e('2026-10-21', 'full')];
    expect(computeConsistency(entries, '2026-10-21').run).toBe(2);
  });

  test('a protected skip keeps the run, an unexplained one resets it', () => {
    const protectedSkip = [e('2026-10-19', 'full'), e('2026-10-20', 'skip-protected'), e('2026-10-21', 'full')];
    expect(computeConsistency(protectedSkip, '2026-10-21').run).toBe(2);

    const bare = [e('2026-10-19', 'full'), e('2026-10-20', 'skip'), e('2026-10-21', 'full')];
    expect(computeConsistency(bare, '2026-10-21').run).toBe(1);
  });

  test('a floor session counts, at full value, for showing up', () => {
    const entries = [e('2026-10-19', 'full'), e('2026-10-21', 'floor')];
    const c = computeConsistency(entries, '2026-10-21');
    expect(c.daysShown).toBe(2);
    expect(c.run).toBe(2);
    expect(c.sessionsThisWeek).toBe(2);
  });

  test('the week is Monday based', () => {
    expect(startOfWeek('2026-10-25')).toBe('2026-10-19');
    const entries = [e('2026-10-18', 'full'), e('2026-10-19', 'full')];
    expect(computeConsistency(entries, '2026-10-25').sessionsThisWeek).toBe(1);
  });

  test('two skip tokens a month, then they are gone', () => {
    const entries = [e('2026-10-05', 'skip-protected'), e('2026-10-12', 'skip-protected')];
    expect(computeConsistency(entries, '2026-10-20').tokensLeft).toBe(0);
    expect(computeConsistency(entries, '2026-11-02').tokensLeft).toBe(2);
  });

  test('consecutive weeks on target stop at the first missed week', () => {
    const entries = [
      e('2026-10-05', 'full'), e('2026-10-07', 'full'), e('2026-10-09', 'full'),
      e('2026-10-12', 'full'), e('2026-10-14', 'full'), e('2026-10-16', 'full'),
      e('2026-10-19', 'full'),
    ];
    expect(computeConsistency(entries, '2026-10-25').weeksOnTarget).toBe(2);
  });

  test('the last skip reason is kept for the weekly review', () => {
    const entries = [e('2026-10-20', 'skip', 'work ran late')];
    expect(computeConsistency(entries, '2026-10-21').lastSkipReason).toBe('work ran late');
  });
});

describe('one day, one page', () => {
  test('a floor session after a full one does not fill two slots', () => {
    const entries = [e('2026-10-19', 'full'), e('2026-10-19', 'floor'), e('2026-10-21', 'full')];
    const result = computeConsistency(entries, '2026-10-22');
    expect(result.sessionsThisWeek).toBe(2);
    expect(result.daysShown).toBe(2);
  });

  test('a full session upgrades a floor session written earlier the same day', () => {
    const entries = [e('2026-10-19', 'floor'), e('2026-10-19', 'full')];
    const result = computeConsistency(entries, '2026-10-19');
    expect(result.sessionsThisWeek).toBe(1);
    expect(result.run).toBe(1);
  });
});
