/**
 * The gate is a toll booth, not a checkpoint.
 *
 * It exists so that silence has a price: either you show up holding the thing
 * you train with, or you spend the skip token. A model that could be fooled by
 * a photograph of a photograph was never the point, and neither is a perfect
 * detector. What matters is that the decision to skip has to be made out loud.
 *
 * So the thresholds below are deliberately forgiving. A false reject costs a
 * session at the exact moment the user is standing in the room ready to train,
 * which is the worst possible trade. A false accept costs one dishonest line in
 * a ledger the user reads every Sunday.
 */

export interface GateScores {
  /** Highest confidence for any person box, 0 to 1. */
  person: number;
  /** Highest confidence for a dumbbell or a loose plate, 0 to 1. */
  dumbbell: number;
  /** Highest confidence for a bench, 0 to 1. The bench is evidence, not a test. */
  bench: number;
}

/**
 * bench  the room was in the picture
 * hand   a person was holding a dumbbell, the bench was not visible
 * unverified  the verifier was not reachable, so the photo was kept and the
 *             page records that no machine looked at it
 */
export type GateGrade = 'bench' | 'hand' | 'unverified';

export type GateVerdict =
  | { pass: true; grade: GateGrade; scores: GateScores | null }
  | { pass: false; hint: string; look: 'both' | 'dumbbell' | 'person'; scores: GateScores };

/** Below these, the model is guessing. Above them, a human would agree. */
export const SEEN = { person: 0.4, dumbbell: 0.5, bench: 0.5 } as const;

export function judge(scores: GateScores): GateVerdict {
  const person = clamp(scores.person);
  const dumbbell = clamp(scores.dumbbell);
  const bench = clamp(scores.bench);
  const seen = { person, dumbbell, bench };

  if (dumbbell < SEEN.dumbbell) {
    return {
      pass: false,
      look: person >= SEEN.person ? 'dumbbell' : 'both',
      scores: seen,
      hint:
        person >= SEEN.person
          ? 'I see you. Hold the dumbbell up where the camera can see it.'
          : 'Nothing yet. Sit on the bench with a dumbbell in your hand.',
    };
  }

  if (person < SEEN.person) {
    return {
      pass: false,
      look: 'person',
      scores: seen,
      hint: 'I see the plates, not you. Get your head and shoulders in the frame.',
    };
  }

  /**
   * The bench is graded, never required. A one handed selfie at arm's length
   * cannot always hold a bench, a dumbbell and a face at once, and a gate that
   * refuses a real session because the seat is out of frame is a gate that
   * teaches the user to hate the app.
   */
  return { pass: true, grade: bench >= SEEN.bench ? 'bench' : 'hand', scores: seen };
}

/**
 * The verifier was unreachable. The photo is still evidence, the session still
 * starts, and the page says so in the user's own ledger. Blocking here would
 * mean a lost session every time the server was asleep, which is most of the
 * time, and a lost session is the one thing this app exists to prevent.
 */
export function unavailable(): Extract<GateVerdict, { pass: true }> {
  return { pass: true, grade: 'unverified', scores: null };
}

/** Two or three words, for a column sixty pixels wide. */
export function gradeWord(grade: GateGrade): string {
  if (grade === 'bench') return 'bench in frame';
  if (grade === 'hand') return 'weight in hand';
  return 'unchecked';
}

export function gradeLabel(grade: GateGrade): string {
  if (grade === 'bench') return 'Showed up, bench in frame';
  if (grade === 'hand') return 'Showed up, dumbbell in hand';
  return 'Showed up, unchecked';
}

/** One line for the page footer, so the evidence is readable next to the number. */
export function scoreLine(scores: GateScores | null): string | null {
  if (!scores) return null;
  const pct = (value: number) => `${Math.round(clamp(value) * 100)}`;
  return `person ${pct(scores.person)} · dumbbell ${pct(scores.dumbbell)} · bench ${pct(scores.bench)}`;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
