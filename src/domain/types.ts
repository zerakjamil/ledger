export type Pattern =
  | 'squat'
  | 'hinge'
  | 'hpush'
  | 'hpull'
  | 'vpush'
  | 'vpull'
  | 'carry'
  | 'core'
  /** A movement from the shelf that does not take one of the eleven slots. */
  | 'other';

export type Loading =
  { kind: 'barbell' } | { kind: 'dumbbell'; hands: 1 | 2 } | { kind: 'bodyweight' };

export type Unit = 'reps' | 'seconds';

export interface Movement {
  id: string;
  name: string;
  pattern: Pattern;
  unit: Unit;
  loading: Loading;
  /** [bottom, top] of the double-progression rep window. */
  range: readonly [number, number];
  startSets: number;
  maxSets: number;
  rirTarget: number;
  /** What to do when the load ceiling binds and there is nothing left to add. */
  levers: readonly string[];
  /**
   * Three things that decide whether the rep counts. Read by the form page
   * only; the engine never looks at it, so a bare movement can omit it.
   */
  cues?: readonly string[];
}

export interface Prescription {
  movementId: string;
  /** Total bar weight for barbell, per-implement weight for dumbbells. */
  loadKg: number;
  sets: number;
  /** Target reps, or target seconds for timed work. */
  target: number;
  /** Index into Movement.levers. 0 means normal loading. */
  stage: number;
}

export interface SetResult {
  reps: number;
  loadKg: number;
  rir: number;
}

export type ProgressionReason =
  | 'no-data'
  | 'hold-partial'
  | 'hold-missed'
  | 'hold-effort'
  | 'add-rep'
  | 'add-load'
  | 'add-set'
  | 'escalate'
  | 'deload'
  | 'maxed';

export interface ProgressionInput {
  movement: Movement;
  prev: Prescription;
  results: readonly SetResult[];
  /** Consecutive sessions that failed to hit target. */
  stalls: number;
}

export interface ProgressionOutput {
  next: Prescription;
  stalls: number;
  reason: ProgressionReason;
}

export interface Equipment {
  /** Bar weight on its own, plates excluded. */
  barKg: number;
  /** One entry per plate pair, per side, in kg. 5 means a pair of 5s. */
  platePairsKg: readonly number[];
  /** Fixed dumbbell sizes available, per hand. */
  dumbbellsKg: readonly number[];
  /** Optional hard ceiling regardless of plates. */
  maxLoadKg?: number;
}

export interface SessionRecord {
  key: SessionKey;
  /** ISO timestamp of session completion. */
  at: string;
  /** Local day the session was written, YYYY-MM-DD. */
  day: string;
  kind: 'full' | 'floor';
}

export type SessionKey = 'A' | 'B' | 'C';
