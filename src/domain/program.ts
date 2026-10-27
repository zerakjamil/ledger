import { loadsFor } from './equipment';
import type { Equipment, Movement, Prescription, SessionKey } from './types';

const M = (m: Movement): Movement => m;

export const MOVEMENTS: Record<string, Movement> = Object.fromEntries(
  [
    M({
      id: 'split-squat',
      name: 'Rear-foot-elevated split squat',
      pattern: 'squat',
      unit: 'reps',
      loading: { kind: 'dumbbell', hands: 2 },
      range: [8, 12],
      startSets: 3,
      maxSets: 4,
      rirTarget: 2,
      levers: ['one more rep', 'a fourth set', 'three-second descent'],
      cues: [
        'Back foot on the bench, laces down. Front shin stays near vertical.',
        'Sink until the front thigh is level, then stand without pushing off the back foot.',
        'If the back knee needs a cushion, the bench is too tall. Lower it.',
      ],
    }),
    M({
      id: 'db-bench',
      name: 'Dumbbell bench press',
      pattern: 'hpush',
      unit: 'reps',
      loading: { kind: 'dumbbell', hands: 2 },
      range: [10, 15],
      startSets: 3,
      maxSets: 4,
      rirTarget: 2,
      levers: ['one more rep', 'a fourth set', 'feet-elevated push-up next'],
      cues: [
        'Shoulder blades pinned back and down before the first rep, and kept there.',
        'Bottom position: dumbbells beside the chest, elbows under them, not flared.',
        'Feet flat, drive the floor away. The dumbbells travel in a slight arc toward the feet.',
      ],
    }),
    M({
      id: 'one-arm-row',
      name: 'Single-arm dumbbell row',
      pattern: 'hpull',
      unit: 'reps',
      loading: { kind: 'dumbbell', hands: 1 },
      range: [10, 15],
      startSets: 3,
      maxSets: 4,
      rirTarget: 2,
      levers: ['one more rep', 'a fourth set', 'two-second pause at the top'],
      cues: [
        'Chest square to the floor. No twisting to finish the rep.',
        'Pull to the hip, not the armpit. Let the shoulder blade travel.',
        'The rep ends when the elbow passes the ribs, not when the shoulder shrugs.',
      ],
    }),
    M({
      id: 'suitcase-carry',
      name: 'Suitcase carry',
      pattern: 'carry',
      unit: 'seconds',
      loading: { kind: 'dumbbell', hands: 1 },
      range: [30, 45],
      startSets: 3,
      maxSets: 4,
      rirTarget: 2,
      levers: ['five more seconds', 'a fourth set', 'switch hands at halfway'],
      cues: [
        'One dumbbell, one side. That asymmetry is the exercise.',
        'Stand tall, ribs down, and do not lean away from the weight.',
        'Switch hands at halfway. Walking is the pacing, so take short steps.',
      ],
    }),
    M({
      id: 'barbell-ohp',
      name: 'Barbell overhead press',
      pattern: 'vpush',
      unit: 'reps',
      loading: { kind: 'barbell' },
      range: [8, 12],
      startSets: 3,
      maxSets: 4,
      rirTarget: 2,
      levers: ['one more rep', 'a fourth set', 'push press on the last set'],
      cues: [
        'Bar on the front delts, elbows slightly in front of it.',
        'Move the head back, press past the chin, then bring it forward again.',
        'Squeeze the glutes. A press that leans back is a bench press standing up.',
      ],
    }),
    M({
      id: 'pushup-feet',
      name: 'Feet-elevated push-up',
      pattern: 'hpush',
      unit: 'reps',
      loading: { kind: 'bodyweight' },
      range: [6, 15],
      startSets: 3,
      maxSets: 4,
      rirTarget: 2,
      levers: ['one more rep', 'a fourth set', 'deficit or a plate on the back'],
      cues: [
        'Feet on the bench, hands under the shoulders.',
        'One straight line from heels to head. Ribs down, glutes on.',
        'Elbows at 45 degrees. Chest to the floor, not the chin.',
      ],
    }),
    M({
      id: 'front-squat',
      name: 'Barbell front squat',
      pattern: 'squat',
      unit: 'reps',
      loading: { kind: 'barbell' },
      range: [12, 20],
      startSets: 3,
      maxSets: 4,
      rirTarget: 2,
      levers: ['one more rep', 'a fourth set', 'EMOM density'],
      cues: [
        'Bar on the front delts, elbows high. If the elbows drop, the bar rolls.',
        'Knees track over the toes. Sit down between the feet.',
        'Stand without the hips shooting back first.',
      ],
    }),
    M({
      id: 'plank',
      name: 'Front plank',
      pattern: 'core',
      unit: 'seconds',
      loading: { kind: 'bodyweight' },
      range: [30, 60],
      startSets: 3,
      maxSets: 3,
      rirTarget: 2,
      levers: ['five more seconds', 'one arm out', 'slow reach'],
      cues: [
        'Forearms under the shoulders, hands flat.',
        'Squeeze glutes, tuck the ribs, push the floor away.',
        'The set ends when the low back sags, not when the clock does.',
      ],
    }),
    M({
      id: 'sl-rdl',
      name: 'Single-leg Romanian deadlift',
      pattern: 'hinge',
      unit: 'reps',
      loading: { kind: 'dumbbell', hands: 1 },
      range: [10, 12],
      startSets: 3,
      maxSets: 4,
      rirTarget: 2,
      levers: ['one more rep', 'a fourth set', 'three-second descent'],
      cues: [
        'Weight in one hand, opposite foot off the floor.',
        'Hinge at the hip. Back flat, hips square to the floor.',
        'Stop where the hamstring stops you, not where the weight reaches the floor.',
      ],
    }),
    M({
      id: 'hip-thrust',
      name: 'Barbell hip thrust',
      pattern: 'hinge',
      unit: 'reps',
      loading: { kind: 'barbell' },
      range: [12, 15],
      startSets: 3,
      maxSets: 4,
      rirTarget: 2,
      levers: ['one more rep', 'a fourth set', 'two-second squeeze at the top'],
      cues: [
        'Upper back on the bench, bar over the hips, chin tucked.',
        'Drive through the heels and stop at a straight line from knees to shoulders.',
        'Two seconds at the top. The ribs stay down the whole time.',
      ],
    }),
    M({
      id: 'dead-bug',
      name: 'Dead bug',
      pattern: 'core',
      unit: 'reps',
      loading: { kind: 'bodyweight' },
      range: [6, 10],
      startSets: 3,
      maxSets: 3,
      rirTarget: 2,
      levers: ['one more rep', 'slower reach', 'heels lower'],
      cues: [
        'Low back pressed into the floor for the whole set.',
        'Opposite arm and leg reach out slowly, together.',
        'If the back lifts, the reach was too far. Come back an inch.',
      ],
    }),
  ].map((m) => [m.id, m]),
);

export interface Session {
  key: SessionKey;
  title: string;
  note: string;
  movementIds: readonly string[];
  warmup: readonly string[];
}

export const SESSIONS: Record<SessionKey, Session> = {
  A: {
    key: 'A',
    title: 'Squat and pull',
    note: 'The heaviest lower day, because the dumbbells carry it.',
    movementIds: ['split-squat', 'one-arm-row', 'db-bench', 'suitcase-carry'],
    warmup: [
      'Five minutes of walking, then ten bodyweight squats.',
      'Twenty band-free arm circles and ten slow hip hinges.',
      'One empty-bar set of the first lift, twelve reps.',
    ],
  },
  B: {
    key: 'B',
    title: 'Press and push',
    note: 'Overhead press leads while the bar still has room to climb.',
    movementIds: ['barbell-ohp', 'pushup-feet', 'front-squat', 'plank'],
    warmup: [
      'Five minutes of walking, then ten arm circles each way.',
      'Fifteen glute bridges, ten scapular push-ups.',
      'One empty-bar set of the press, ten reps.',
    ],
  },
  C: {
    key: 'C',
    title: 'Hinge and carry',
    note: 'Posterior chain and the back work the kit can actually load.',
    movementIds: ['sl-rdl', 'hip-thrust', 'one-arm-row', 'dead-bug'],
    warmup: [
      'Five minutes of walking, then ten hip hinges.',
      'Ten glute bridges, twenty seconds of dead hang or doorway stretch.',
      'One set of the hinge with no weight, eight reps per leg.',
    ],
  },
};

export const ROTATION: readonly SessionKey[] = ['A', 'B', 'C'];

/** Conservative starting point. The two calibration sessions replace these numbers. */
export function initialPrescription(movement: Movement, eq: Equipment): Prescription {
  const loads = loadsFor(movement.loading, eq);
  const loadKg = movement.loading.kind === 'barbell' ? eq.barKg : loads.length > 0 ? loads[0]! : 0;
  return {
    movementId: movement.id,
    loadKg,
    sets: movement.startSets,
    target: movement.range[0],
    stage: 0,
  };
}

export const FLOOR_SESSION: readonly string[] = ['split-squat', 'one-arm-row', 'pushup-feet'];
