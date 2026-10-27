import { describe, expect, test } from 'bun:test';
import { weeklyAdvice, type AdviceInput } from './coach';

const base: AdviceInput = {
  sessionsThisWeek: 2,
  weekTarget: 3,
  run: 4,
  weeksOnTarget: 1,
  slopePerWeek: -0.5,
  lastSkipReason: null,
  floorKept: null,
  daysLeftInWeek: 4,
};

describe('weekly advice', () => {
  test('one change only, and it is about the schedule when the week is nearly gone', () => {
    const advice = weeklyAdvice({ ...base, sessionsThisWeek: 0, daysLeftInWeek: 1 });
    expect(advice.kind).toBe('schedule');
  });

  test('a skip reason moves the anchor before it blames the effort', () => {
    const advice = weeklyAdvice({ ...base, lastSkipReason: 'work ran late' });
    expect(advice.kind).toBe('move-anchor');
    expect(advice.body).toContain('work ran late');
  });

  test('a flat average adds steps, not a smaller dinner', () => {
    expect(weeklyAdvice({ ...base, slopePerWeek: -0.05 }).kind).toBe('add-steps');
  });

  test('losing too fast buys food, not discipline', () => {
    expect(weeklyAdvice({ ...base, slopePerWeek: -1.4 }).kind).toBe('eat-more');
  });

  test('no trend yet asks for data instead of a change', () => {
    expect(weeklyAdvice({ ...base, slopePerWeek: null }).kind).toBe('collect');
  });

  test('a missed floor becomes the change, not a footnote', () => {
    const advice = weeklyAdvice({ ...base, floorKept: false });
    expect(advice.kind).toBe('floor');
    expect(advice.body).toContain('Eight thousand steps');
  });

  test('a kept floor leaves the advice alone', () => {
    expect(weeklyAdvice({ ...base, floorKept: true }).kind).toBe('hold');
  });

  test('three weeks on target says do nothing', () => {
    expect(weeklyAdvice({ ...base, weeksOnTarget: 3 }).kind).toBe('hold');
  });

  test('the default is holding, never stacking changes', () => {
    expect(weeklyAdvice(base).kind).toBe('hold');
  });
});
