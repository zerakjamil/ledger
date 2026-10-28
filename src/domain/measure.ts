import { parseInputNumber } from './number';

/**
 * A waist outside this is a unit mix-up or a typo, not a measurement.
 * Centimetres, at the navel. The same for bodyweight: 30 to 300 kg.
 */
export const MEASURE_RANGE = {
  waist: { floor: 50, ceiling: 200, unit: 'cm' },
  weight: { floor: 30, ceiling: 300, unit: 'kg' },
} as const;

export type Measure = keyof typeof MEASURE_RANGE;

export function inMeasureRange(measure: Measure, value: number): boolean {
  const { floor, ceiling } = MEASURE_RANGE[measure];
  return value >= floor && value <= ceiling;
}

/**
 * Where a reading falls on the printed tape: 0 at the floor, 1 at the ceiling.
 * Clamped, because a needle that can leave the paper is a drawing error, not
 * information. `tapeOverflow` carries the part the clamp throws away.
 */
export function tapePosition(measure: Measure, value: number): number {
  const { floor, ceiling } = MEASURE_RANGE[measure];
  const span = ceiling - floor;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (value - floor) / span));
}

/** Which end of the tape the reading ran off, if it did. */
export function tapeOverflow(measure: Measure, value: number): 'low' | 'high' | null {
  const { floor, ceiling } = MEASURE_RANGE[measure];
  if (value < floor) return 'low';
  if (value > ceiling) return 'high';
  return null;
}

/**
 * Both fields read as numbers. A full field can still be outside the range.
 * Naming which number, and which side of the range it fell on, is the
 * difference between a fix and a wall.
 */
export function measureComplaint(waistValue: number, weightValue: number): string | null {
  const badWaist = !inMeasureRange('waist', waistValue);
  const badWeight = !inMeasureRange('weight', weightValue);
  if (!badWaist && !badWeight) return null;

  const parts: string[] = [];
  if (badWaist) {
    const { floor, ceiling } = MEASURE_RANGE.waist;
    const side =
      waistValue < floor ? `below the ${floor} cm floor` : `above the ${ceiling} cm ceiling`;
    parts.push(`The waist reads ${waistValue.toFixed(1)} cm, ${side}.`);
    if (waistValue >= 15 && waistValue < floor) {
      parts.push(`If that was inches, it is ${(waistValue * 2.54).toFixed(1)} cm.`);
    }
  }
  if (badWeight) {
    const { floor, ceiling } = MEASURE_RANGE.weight;
    const side =
      weightValue < floor ? `below the ${floor} kg floor` : `above the ${ceiling} kg ceiling`;
    parts.push(`The weight reads ${weightValue.toFixed(1)} kg, ${side}.`);
  }
  if (!badWeight) parts.push('The weight is fine.');
  if (!badWaist) parts.push('The waist is fine.');
  parts.push('Nothing was saved.');
  return parts.join(' ');
}

/**
 * The short line under a field: what the range is, and what the field holds.
 * An empty field reads as nothing, because it is not a mistake until signed.
 */
export function measureIssue(measure: Measure, raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const value = parseInputNumber(text);
  if (value === null) return 'This does not read as a number.';
  const { floor, ceiling, unit } = MEASURE_RANGE[measure];
  if (!inMeasureRange(measure, value)) {
    return `${floor} to ${ceiling} ${unit}. This reads ${value.toFixed(1)}.`;
  }
  return null;
}
