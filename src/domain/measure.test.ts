import { describe, expect, test } from 'bun:test';
import { inMeasureRange, measureComplaint, measureIssue } from './measure';

describe('the two numbers that matter', () => {
  test('a waist of 34 is named as outside the centimetre range', () => {
    expect(measureIssue('waist', '34')).toBe('50 to 200 cm. This reads 34.0.');
    expect(inMeasureRange('waist', 34)).toBe(false);
  });

  test('a waist of 86.4 is accepted, comma or point', () => {
    expect(measureIssue('waist', '86.4')).toBeNull();
    expect(measureIssue('waist', '86,4')).toBeNull();
    expect(inMeasureRange('waist', 86.4)).toBe(true);
  });

  test('weight has its own floor and ceiling', () => {
    expect(measureIssue('weight', '20')).toBe('30 to 300 kg. This reads 20.0.');
    expect(measureIssue('weight', '90')).toBeNull();
  });

  test('an empty field waits for the signature', () => {
    expect(measureIssue('waist', '')).toBeNull();
    expect(measureIssue('weight', '   ')).toBeNull();
  });

  test('noise is called noise, not a number', () => {
    expect(measureIssue('waist', 'abc')).toBe('This does not read as a number.');
  });
});

describe('the signature names the number that is wrong', () => {
  test('a 34 cm waist is named, converted, and the weight is cleared', () => {
    const message = measureComplaint(34, 90);
    expect(message).toContain('The waist reads 34.0 cm, below the 50 cm floor.');
    expect(message).toContain('If that was inches, it is 86.4 cm.');
    expect(message).toContain('The weight is fine.');
    expect(message).toContain('Nothing was saved.');
  });

  test('two wrong numbers are both named', () => {
    const message = measureComplaint(20, 400);
    expect(message).toContain('The waist reads 20.0 cm');
    expect(message).toContain('The weight reads 400.0 kg, above the 300 kg ceiling.');
    expect(message).not.toContain('is fine');
  });

  test('a real waist and a real weight pass without a word', () => {
    expect(measureComplaint(86.4, 90)).toBeNull();
    expect(measureComplaint(50, 30)).toBeNull();
  });
});
