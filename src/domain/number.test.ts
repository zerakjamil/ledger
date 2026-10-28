import { describe, expect, test } from 'bun:test';
import { parseInputNumber } from './number';

describe('reading a number from a phone keyboard', () => {
  test('plain numbers, with or without a decimal point', () => {
    expect(parseInputNumber('34')).toBe(34);
    expect(parseInputNumber('86.4')).toBe(86.4);
    expect(parseInputNumber(' 90 ')).toBe(90);
  });

  test('a comma is a decimal point', () => {
    expect(parseInputNumber('86,4')).toBe(86.4);
  });

  test('Arabic-Indic and Persian digits read as digits', () => {
    expect(parseInputNumber('٩٦')).toBe(96);
    expect(parseInputNumber('۹۶٫۵')).toBe(96.5);
    expect(parseInputNumber('٩٦٫٤')).toBe(96.4);
  });

  test('a unit typed after the number is ignored', () => {
    expect(parseInputNumber('86.4 cm')).toBe(86.4);
    expect(parseInputNumber('90kg')).toBe(90);
  });

  test('nothing, or noise, is not a number', () => {
    expect(parseInputNumber('')).toBeNull();
    expect(parseInputNumber('   ')).toBeNull();
    expect(parseInputNumber('abc')).toBeNull();
    expect(parseInputNumber('.')).toBeNull();
    expect(parseInputNumber('-')).toBeNull();
  });
});
