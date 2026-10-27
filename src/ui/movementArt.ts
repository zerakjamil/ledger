import type { ImageSourcePropType } from 'react-native';

/**
 * Demonstration loops for the eleven movements in the plan.
 *
 * Source: exercises-dataset (github.com/hasaneyldrm/exercises-dataset), whose
 * media is © Gym visual. That is a personal-use set, not a redistributable one:
 * see docs/ASSETS.md before this app goes anywhere near a store.
 *
 * Each file was duotoned to the page palette, so the studio white behind the
 * figure becomes the paper the page is printed on and the loop reads as a plate
 * inked into the log instead of a video pasted onto it.
 *
 * Metro resolves require() statically, so this table is written out by hand.
 */
const PLATES: Record<string, ImageSourcePropType> = {
  'split-squat': require('../../assets/movements/split-squat.gif'),
  'db-bench': require('../../assets/movements/db-bench.gif'),
  'one-arm-row': require('../../assets/movements/one-arm-row.gif'),
  'suitcase-carry': require('../../assets/movements/suitcase-carry.gif'),
  'barbell-ohp': require('../../assets/movements/barbell-ohp.gif'),
  'pushup-feet': require('../../assets/movements/pushup-feet.gif'),
  'front-squat': require('../../assets/movements/front-squat.gif'),
  plank: require('../../assets/movements/plank.gif'),
  'sl-rdl': require('../../assets/movements/sl-rdl.gif'),
  'hip-thrust': require('../../assets/movements/hip-thrust.gif'),
  'dead-bug': require('../../assets/movements/dead-bug.gif'),
};

/**
 * Where the demo is a neighbouring variation rather than the plan's own, say
 * so. A loop that quietly teaches the wrong setup is worse than none.
 */
const DEMO_NOTES: Record<string, string> = {
  'split-squat': 'The demo leaves the back foot on the floor. Yours goes on the bench.',
  'suitcase-carry': 'The demo carries two. Yours carries one, which is the harder version.',
  'pushup-feet': 'The demo elevates the feet on a box. A bench does the same job.',
  plank: 'The demo wears a plate. Yours is the same hold with nothing on it.',
  'hip-thrust': 'The demo is filed as a glute bridge. Hips on the bench is the same movement.',
};

export function plateFor(id: string): ImageSourcePropType | null {
  return PLATES[id] ?? null;
}

export function demoNote(id: string): string | null {
  return DEMO_NOTES[id] ?? null;
}
