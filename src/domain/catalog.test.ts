import { describe, expect, test } from 'bun:test';
import {
  BODY_GROUPS,
  CATALOG,
  bodyGroupOf,
  catalogMatches,
  catalogMovement,
  catalogRecord,
  classify,
  equipmentLabel,
} from './catalog';
import { slotsForPattern } from './library';

const byName = (name: string) => {
  const record = CATALOG.find((item) => item.name === name);
  if (!record) throw new Error(`Missing catalog record: ${name}`);
  return record;
};

describe('the catalog is the room, not the gym', () => {
  test('every record uses the dumbbells, the bar or the floor', () => {
    expect(CATALOG.length).toBeGreaterThan(600);
    for (const record of CATALOG) {
      expect(['dumbbell', 'barbell', 'body weight', 'weighted']).toContain(record.equipment);
    }
  });

  test('nothing that needs a bar, a machine or a ball survived the filter', () => {
    expect(CATALOG.some((record) => /pull[ -]?up|chin[ -]?up|machine|stability ball|bosu/i.test(record.name))).toBe(
      false,
    );
  });

  test('every record has steps and a readable label', () => {
    for (const record of CATALOG) {
      expect(record.steps.length).toBeGreaterThan(0);
      expect(record.name.charAt(0)).toBe(record.name.charAt(0).toUpperCase());
      expect(record.name).not.toMatch(/_|\(male\)|\(female\)/i);
    }
  });

  test('the rack list is exact, not a loose pattern', () => {
    const rack = CATALOG.filter((record) => record.needsRack).map((record) => record.name);
    expect(rack).toHaveLength(20);
    expect(rack).toContain('Barbell bench press');
    expect(rack).toContain('Barbell full squat');
    expect(rack).not.toContain('Barbell squat (on knees)');
    expect(rack).not.toContain('Barbell squat jump step rear lunge');
  });
});

describe('a name decides the slot', () => {
  test('the obvious compounds land in their pattern', () => {
    expect(classify('Dumbbell goblet squat')).toBe('squat');
    expect(classify('Barbell romanian deadlift')).toBe('hinge');
    expect(classify('Barbell bench press')).toBe('hpush');
    expect(classify('Barbell bent over row')).toBe('hpull');
    expect(classify('Barbell overhead press')).toBe('vpush');
    expect(classify('Farmers walk')).toBe('carry');
    expect(classify('Front plank with twist')).toBe('core');
    expect(classify('Barbell curl')).toBe('other');
  });

  test('narrow contains row but is still a squat', () => {
    expect(classify('Barbell narrow stance squat')).toBe('squat');
  });

  test('a side bridge is core, a glute bridge is a hinge', () => {
    expect(classify('Side bridge')).toBe('core');
    expect(classify('Barbell glute bridge')).toBe('hinge');
  });

  test('an upright row is a press before it is a row', () => {
    expect(classify('Barbell upright row')).toBe('vpush');
  });

  test('the program has exactly the slots its patterns promise', () => {
    expect(slotsForPattern('squat')).toHaveLength(2);
    expect(slotsForPattern('hinge')).toHaveLength(2);
    expect(slotsForPattern('hpush')).toHaveLength(2);
    expect(slotsForPattern('hpull')).toHaveLength(1);
    expect(slotsForPattern('vpush')).toHaveLength(1);
    expect(slotsForPattern('carry')).toHaveLength(1);
    expect(slotsForPattern('core')).toHaveLength(2);
    expect(slotsForPattern('other')).toHaveLength(0);
  });
});

describe('a catalog record becomes a movement the engine understands', () => {
  test('one dumbbell is one hand, two is two', () => {
    const goblet = catalogMovement(byName('Dumbbell goblet squat'));
    expect(goblet.loading).toEqual({ kind: 'dumbbell', hands: 1 });
    const bench = catalogMovement(byName('Dumbbell bench press'));
    expect(bench.loading).toEqual({ kind: 'dumbbell', hands: 2 });
  });

  test('a bar is a bar and added weight is still bodyweight', () => {
    expect(catalogMovement(byName('Barbell deadlift')).loading).toEqual({ kind: 'barbell' });
    expect(catalogMovement(byName('Push-up (wall)')).loading).toEqual({ kind: 'bodyweight' });
    expect(catalogMovement(byName('Weighted sissy squat')).loading).toEqual({ kind: 'bodyweight' });
  });

  test('a carry is held, a dead bug is counted', () => {
    const carry = catalogMovement(byName('Farmers walk'));
    expect(carry.unit).toBe('seconds');
    expect(carry.range).toEqual([30, 45]);
    const bug = catalogMovement(byName('Dead bug'));
    expect(bug.unit).toBe('reps');
    expect(bug.range).toEqual([8, 12]);
  });

  test('the starting point is the same conservative one the program uses', () => {
    const movement = catalogMovement(byName('Dumbbell goblet squat'));
    expect(movement.startSets).toBe(3);
    expect(movement.rirTarget).toBe(2);
    expect(movement.cues).toHaveLength(3);
    expect(movement.id).toBe(catalogRecord(byName('Dumbbell goblet squat').id)!.id);
  });
});

describe('search reads muscles as well as names', () => {
  const goblet = byName('Dumbbell goblet squat');

  test('an empty query keeps everything', () => {
    expect(catalogMatches(goblet, '')).toBe(true);
    expect(catalogMatches(goblet, '   ')).toBe(true);
  });

  test('every word must match somewhere', () => {
    expect(catalogMatches(goblet, 'goblet')).toBe(true);
    expect(catalogMatches(goblet, 'dumbbell squat')).toBe(true);
    expect(catalogMatches(goblet, 'quads')).toBe(true);
    expect(catalogMatches(goblet, 'dumbbell')).toBe(true);
    expect(catalogMatches(goblet, 'barbell')).toBe(false);
    expect(catalogMatches(goblet, 'goblet bench')).toBe(false);
  });

  test('a muscle search finds more than the name does', () => {
    const glutes = CATALOG.filter((record) => catalogMatches(record, 'glute'));
    expect(glutes.length).toBeGreaterThan(20);
  });
});

describe('the shelf labels stay honest', () => {
  test('body parts collapse into the chips', () => {
    expect(bodyGroupOf(byName('Dumbbell goblet squat'))).toBe('legs');
    expect(bodyGroupOf(byName('Barbell bench press'))).toBe('chest');
    expect(bodyGroupOf(byName('Dead bug'))).toBe('core');
    const cardio = CATALOG.find((record) => record.bodyPart === 'cardio');
    expect(cardio).toBeDefined();
    expect(bodyGroupOf(cardio!)).toBe('cardio');
    const keys = new Set(BODY_GROUPS.map((group) => group.key));
    for (const record of CATALOG) expect(keys.has(bodyGroupOf(record))).toBe(true);
  });

  test('equipment reads like the room, not like the dataset', () => {
    expect(equipmentLabel(byName('Push-up (wall)'))).toBe('bodyweight');
    expect(equipmentLabel(byName('Weighted sissy squat'))).toBe('added weight');
    expect(equipmentLabel(byName('Dumbbell goblet squat'))).toBe('dumbbell');
  });
});
