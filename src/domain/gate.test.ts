import { describe, expect, test } from 'bun:test';
import { gradeLabel, gradeWord, judge, scoreLine, unavailable } from './gate';

describe('gate', () => {
  test('a person holding a dumbbell on a bench passes with the strongest grade', () => {
    const verdict = judge({ person: 0.91, dumbbell: 0.88, bench: 0.72 });
    expect(verdict.pass).toBe(true);
    if (verdict.pass) expect(verdict.grade).toBe('bench');
  });

  test('the bench is graded, never required', () => {
    const verdict = judge({ person: 0.82, dumbbell: 0.66, bench: 0 });
    expect(verdict.pass).toBe(true);
    if (verdict.pass) expect(verdict.grade).toBe('hand');
  });

  test('an empty room asks for both, without pretending the photo was bad', () => {
    const verdict = judge({ person: 0.02, dumbbell: 0.04, bench: 0.3 });
    expect(verdict.pass).toBe(false);
    if (!verdict.pass) {
      expect(verdict.look).toBe('both');
      expect(verdict.hint).toContain('Sit on the bench');
    }
  });

  test('a visible person without the weight asks for the weight', () => {
    const verdict = judge({ person: 0.9, dumbbell: 0.1, bench: 0.8 });
    expect(verdict.pass).toBe(false);
    if (!verdict.pass) {
      expect(verdict.look).toBe('dumbbell');
      expect(verdict.hint).toContain('Hold the dumbbell up');
    }
  });

  test('a dumbbell alone asks for the person', () => {
    const verdict = judge({ person: 0.1, dumbbell: 0.8, bench: 0.6 });
    expect(verdict.pass).toBe(false);
    if (!verdict.pass) {
      expect(verdict.look).toBe('person');
      expect(verdict.hint).toContain('not you');
    }
  });

  test('a verifier outage is a pass, and the page says it was unchecked', () => {
    const verdict = unavailable();
    expect(verdict.pass).toBe(true);
    expect(verdict.grade).toBe('unverified');
    expect(scoreLine(verdict.scores)).toBeNull();
  });

  test('nonsense scores never throw or pass', () => {
    const verdict = judge({ person: Number.NaN, dumbbell: -2, bench: 8 });
    expect(verdict.pass).toBe(false);
  });

  test('the grades read as sentences, not as scores', () => {
    expect(gradeLabel('bench')).toBe('Showed up, bench in frame');
    expect(gradeLabel('hand')).toBe('Showed up, dumbbell in hand');
    expect(gradeLabel('unverified')).toBe('Showed up, unchecked');
  });

  test('the column label is short enough to sit under a thumbnail', () => {
    expect(gradeWord('bench')).toBe('bench in frame');
    expect(gradeWord('hand')).toBe('weight in hand');
    expect(gradeWord('unverified')).toBe('unchecked');
  });

  test('the score line is readable on the page', () => {
    expect(scoreLine({ person: 0.91, dumbbell: 0.88, bench: 0.72 })).toBe(
      'person 91 · dumbbell 88 · bench 72',
    );
  });
});
