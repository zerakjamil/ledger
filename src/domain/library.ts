import { catalogMovement, catalogRecord } from './catalog';
import { MOVEMENTS, SESSIONS } from './program';
import type { Movement, Pattern, SessionKey } from './types';

/**
 * One lookup for both kinds of movement.
 *
 * A program movement has a hand-written definition in `program.ts`. A shelf
 * movement is built from its catalog record. The rest of the app should never
 * care which kind it is holding: a slot, a page and the engine all speak
 * `Movement`.
 */

export interface ProgramSlot {
  /** The program movement the slot belongs to, and the key state stores. */
  id: string;
  session: SessionKey;
  /** 1-based position in the session. */
  index: number;
  movement: Movement;
}

/**
 * The eleven slots, once each. One-arm row appears in both A and C; it is one
 * prescription and one slot, so swapping it changes both pages.
 */
export const PROGRAM_SLOTS: readonly ProgramSlot[] = (() => {
  const seen = new Set<string>();
  const slots: ProgramSlot[] = [];
  for (const key of ['A', 'B', 'C'] as SessionKey[]) {
    SESSIONS[key].movementIds.forEach((id, index) => {
      if (seen.has(id)) return;
      const movement = MOVEMENTS[id];
      if (!movement) return;
      seen.add(id);
      slots.push({ id, session: key, index, movement });
    });
  }
  return slots;
})();

export const PROGRAM_SLOT_IDS: ReadonlySet<string> = new Set(PROGRAM_SLOTS.map((slot) => slot.id));

export function programSlot(id: string): ProgramSlot | null {
  return PROGRAM_SLOTS.find((slot) => slot.id === id) ?? null;
}

export function slotsForPattern(pattern: Pattern): ProgramSlot[] {
  return PROGRAM_SLOTS.filter((slot) => slot.movement.pattern === pattern);
}

/** Which slot currently holds this movement, if any. */
export function slotOfMovement(
  slots: Readonly<Record<string, string>>,
  movementId: string,
): ProgramSlot | null {
  return PROGRAM_SLOTS.find((slot) => (slots[slot.id] ?? slot.id) === movementId) ?? null;
}

/** A rack movement stays on the shelf; it cannot take a slot. */
export function needsRack(id: string): boolean {
  return catalogRecord(id)?.needsRack === true;
}

const built = new Map<string, Movement>();

export function movementById(id: string): Movement | null {
  const program = MOVEMENTS[id];
  if (program) return program;
  const cached = built.get(id);
  if (cached) return cached;
  const record = catalogRecord(id);
  if (!record) return null;
  const movement = catalogMovement(record);
  built.set(id, movement);
  return movement;
}

export function isShelfMovement(id: string): boolean {
  return catalogRecord(id) !== null;
}
