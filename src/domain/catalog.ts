import raw from '../data/catalog.json';
import type { Loading, Movement, Pattern, Unit } from './types';

/**
 * The movement shelf: every exercise the room can load.
 *
 * Built from exercises-dataset (github.com/hasaneyldrm/exercises-dataset) by
 * scripts/build-catalog.mjs. Media is © Gym visual; the app bundles it for one
 * phone, not for a store. See docs/ASSETS.md.
 *
 * The dataset is a catalogue, not a program. It has no sets, no progression and
 * no idea which movements belong in a slot. Everything below turns one record
 * into the same `Movement` shape the engine already understands, so a shelf
 * movement can take a slot without the engine learning a second vocabulary.
 */

export interface CatalogRecord {
  id: string;
  name: string;
  equipment: string;
  bodyPart: string;
  target: string;
  secondary: readonly string[];
  steps: readonly string[];
  /** Needs a rack to unrack. The room has none, so this cannot take a slot. */
  needsRack: boolean;
}

export const CATALOG = raw as CatalogRecord[];

const BY_ID = new Map(CATALOG.map((record) => [record.id, record]));

export function catalogRecord(id: string): CatalogRecord | null {
  return BY_ID.get(id) ?? null;
}

/**
 * Which slot a movement belongs in.
 *
 * The engine never reads `pattern`; the shelf reads it to decide which slots a
 * movement fits. The dataset has no pattern field, so the name carries the
 * decision. Ordered from specific to general: "upright row" is a press before
 * it is a row, "reverse fly" is a pull before it is a fly, and "narrow stance
 * squat" must not become a row because it contains the letters r-o-w.
 */
export function classify(name: string): Pattern {
  const n = name.toLowerCase();

  if (/(suitcase|farmer|carry|waiter walk)/.test(n)) return 'carry';

  if (
    /(plank|dead bug|dead-bug|crunch|sit-up|sit up|hollow|leg raise|knee raise|ab wheel|rollout|russian twist|bicycle|mountain climber|wood chop|pallof|bird dog|flutter kick|scissor|v-up|toe touch|jackknife|side bridge)/.test(
      n,
    )
  ) {
    return 'core';
  }

  if (
    /(deadlift|romanian|rdl|good morning|hip thrust|glute bridge|bridge|swing|pull-through|back extension|hyperextension|hip extension)/.test(
      n,
    ) &&
    !/side bridge/.test(n)
  ) {
    return 'hinge';
  }

  if (
    /(upright row|overhead press|shoulder press|military press|strict press|push press|arnold press|lateral raise|front raise|handstand)/.test(
      n,
    )
  ) {
    return 'vpush';
  }

  if (
    /(\brows?\b|pulldown|pull-down|pullover|face pull|reverse fly|rear delt|pull up|pull-up|chin-up)/.test(n)
  ) {
    return 'hpull';
  }

  if (
    /(bench press|floor press|chest press|push-up|push up|pushup|chest fly|pec fly|fly|dip)/.test(n) &&
    !/reverse fly|rear delt/.test(n)
  ) {
    return 'hpush';
  }

  if (/(squat|lunge|step-up|step up|pistol|wall sit)/.test(n)) return 'squat';

  return 'other';
}

export function patternLabel(pattern: Pattern): string {
  switch (pattern) {
    case 'hpush':
      return 'horizontal push';
    case 'hpull':
      return 'horizontal pull';
    case 'vpush':
      return 'vertical push';
    case 'vpull':
      return 'vertical pull';
    case 'other':
      return 'accessory';
    default:
      return pattern;
  }
}

/**
 * One dumbbell means per-implement weight is the whole load; two means the
 * number in the prescription is one hand. Getting this wrong doubles or halves
 * every dumbbell set on the shelf.
 */
function loadingFor(record: CatalogRecord): Loading {
  if (record.equipment === 'barbell') return { kind: 'barbell' };
  if (record.equipment === 'dumbbell') {
    const one =
      /(one[- ]arm|single[- ]arm|one[- ]leg|single[- ]leg|suitcase|goblet|pullover|kickback|concentration|overhead carry|wood chop)/.test(
        record.name.toLowerCase(),
      );
    return { kind: 'dumbbell', hands: one ? 1 : 2 };
  }
  /**
   * Weighted bodyweight is a plate on the back or a dumbbell between the feet,
   * not a bar. Treating it as barbell would ask the plate arithmetic for a load
   * the movement never puts on the bar.
   */
  return { kind: 'bodyweight' };
}

function unitFor(name: string): Unit {
  const n = name.toLowerCase();
  /**
   * \bwalk\b keeps "walking lunge" a rep movement. A carry and a plank are held;
   * a lunge that happens to walk is not.
   */
  if (/(^| )plank$|plank hold|\bhold\b|carry|farmer|\bwalk\b|wall sit|isometric/.test(n)) {
    return 'seconds';
  }
  return 'reps';
}

function rangeFor(name: string, unit: Unit): readonly [number, number] {
  if (unit === 'seconds') {
    return /(carry|farmer|\bwalk\b)/.test(name.toLowerCase()) ? [30, 45] : [20, 45];
  }
  const n = name.toLowerCase();
  if (/push-up|push up|pushup/.test(n)) return [6, 15];
  if (/(curl|raise|fly|extension|kickback|calf|wrist|shrug|rear delt|lateral)/.test(n)) {
    return [10, 15];
  }
  return [8, 12];
}

/**
 * The same conservative starting point the program uses: three sets, two in
 * reserve, and the bottom of the rep window. The calibration sessions and the
 * progression engine take it from there.
 */
export function catalogMovement(record: CatalogRecord): Movement {
  const pattern = classify(record.name);
  const unit = unitFor(record.name);
  const seconds = unit === 'seconds';
  return {
    id: record.id,
    name: record.name,
    pattern,
    unit,
    loading: loadingFor(record),
    range: rangeFor(record.name, unit),
    startSets: 3,
    maxSets: pattern === 'core' ? 3 : 4,
    rirTarget: 2,
    levers: seconds
      ? ['five more seconds', 'a fourth set', 'a harder position']
      : ['one more rep', 'a fourth set', 'two-second pause'],
    cues: record.steps.slice(0, 3),
  };
}

/** The chips above the shelf. Every body part in the dataset lands in one. */
export type BodyGroup = 'all' | 'legs' | 'back' | 'chest' | 'arms' | 'shoulders' | 'core' | 'cardio';

export const BODY_GROUPS: readonly { key: BodyGroup; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'legs', label: 'Legs' },
  { key: 'back', label: 'Back' },
  { key: 'chest', label: 'Chest' },
  { key: 'arms', label: 'Arms' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'core', label: 'Core' },
  { key: 'cardio', label: 'Cardio' },
];

export function bodyGroupOf(record: CatalogRecord): BodyGroup {
  switch (record.bodyPart) {
    case 'upper legs':
    case 'lower legs':
      return 'legs';
    case 'back':
      return 'back';
    case 'chest':
      return 'chest';
    case 'upper arms':
    case 'lower arms':
      return 'arms';
    case 'shoulders':
    case 'neck':
      return 'shoulders';
    case 'waist':
      return 'core';
    case 'cardio':
      return 'cardio';
    default:
      return 'all';
  }
}

/**
 * Search reads the movement, the muscle it targets and the muscles it assists.
 * Typing "glute" should find a squat, not only a movement with glute in its
 * name. Every word must match somewhere, so "dumbbell row" narrows instead of
 * widening.
 */
export function catalogMatches(record: CatalogRecord, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = [record.name, record.equipment, record.target, record.bodyPart, ...record.secondary]
    .join(' ')
    .toLowerCase();
  return words.every((word) => hay.includes(word));
}

export function equipmentLabel(record: CatalogRecord): string {
  switch (record.equipment) {
    case 'body weight':
      return 'bodyweight';
    case 'weighted':
      return 'added weight';
    default:
      return record.equipment;
  }
}
