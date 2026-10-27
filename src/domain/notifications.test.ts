import { describe, expect, test } from 'bun:test';
import { cancelAfterStart, planNotifications } from './notifications';
import type { NotificationPrefs } from './notifications';

const prefs: NotificationPrefs = {
  anchorHour: 19,
  anchorMinute: 0,
  trainingDays: [1, 3, 5],
  reviewDay: 0,
  reviewHour: 18,
};

const sundayMorning = new Date(2026, 9, 25, 9, 0, 0);

describe('notification planner', () => {
  test('only training days, an anchor and one fallback, plus a single review', () => {
    const specs = planNotifications({ now: sundayMorning, prefs, horizonDays: 7 });
    const kinds = specs.map((s) => s.kind);
    expect(kinds.filter((k) => k === 'review')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'anchor')).toHaveLength(3);
    expect(kinds.filter((k) => k === 'fallback')).toHaveLength(3);

    const anchorDays = specs
      .filter((s) => s.kind === 'anchor')
      .map((s) => s.at.getDay());
    expect(anchorDays).toEqual([1, 3, 5]);
  });

  test('nothing is ever scheduled in the past and ids are unique', () => {
    const specs = planNotifications({ now: sundayMorning, prefs, horizonDays: 14 });
    for (const spec of specs) {
      expect(spec.at.getTime()).toBeGreaterThan(sundayMorning.getTime());
    }
    const ids = specs.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('a fallback always lands 90 minutes after its anchor', () => {
    const specs = planNotifications({ now: sundayMorning, prefs, horizonDays: 7 });
    const anchors = specs.filter((s) => s.kind === 'anchor');
    for (const anchor of anchors) {
      const day = anchor.id.replace('anchor-', '');
      const fallback = specs.find((s) => s.id === `fallback-${day}`);
      expect(fallback).toBeDefined();
      expect(fallback!.at.getTime() - anchor.at.getTime()).toBe(90 * 60_000);
    }
  });

  test('a closed day keeps the phone quiet, trained or skipped', () => {
    const today: NotificationPrefs = { ...prefs, trainingDays: [0] };
    const without = planNotifications({ now: sundayMorning, prefs: today, horizonDays: 1 });
    const withDone = planNotifications({
      now: sundayMorning,
      prefs: today,
      horizonDays: 1,
      closedToday: true,
    });
    expect(without.length).toBe(4);
    expect(withDone).toHaveLength(1);
    expect(withDone[0]!.kind).toBe('review');
  });

  test('the pending queue never exceeds the platform budget', () => {
    const specs = planNotifications({ now: sundayMorning, prefs, horizonDays: 90, maxPending: 60 });
    expect(specs).toHaveLength(60);
  });

  test('a page that was never written comes back the next morning', () => {
    const specs = planNotifications({
      now: sundayMorning,
      prefs,
      horizonDays: 3,
      stake: 'Ten to the jar for every unexplained skip.',
      since: '2026-10-25',
    });
    const debt = specs.find((s) => s.kind === 'debt')!;
    expect(debt.at.getHours()).toBe(8);
    expect(debt.at.getDate()).toBe(27);
    expect(debt.title).toBe('Yesterday went unwritten');
    expect(debt.body).toContain('Ten to the jar for every unexplained skip.');
    expect(debt.data.route).toBe('/session?kind=floor');
  });

  test('opening before dawn still arms the alarm for yesterday', () => {
    const tuesdayDawn = new Date(2026, 9, 27, 2, 0, 0);
    const specs = planNotifications({ now: tuesdayDawn, prefs, horizonDays: 3 });
    const monday = specs.find((s) => s.id === 'debt-2026-10-26')!;
    expect(monday).toBeDefined();
    expect(monday.at.getDate()).toBe(27);
    expect(monday.at.getHours()).toBe(8);
  });

  test('a contract signed today does not arm an alarm for yesterday', () => {
    const tuesdayDawn = new Date(2026, 9, 27, 2, 0, 0);
    const specs = planNotifications({
      now: tuesdayDawn,
      prefs,
      horizonDays: 3,
      since: '2026-10-27',
    });
    expect(specs.some((s) => s.id === 'debt-2026-10-26')).toBe(false);
    /** The next appointment's own alarm is legitimate and must stay. */
    expect(specs.some((s) => s.id === 'debt-2026-10-28')).toBe(true);
  });

  test('a session on the morning of the alarm silences it', () => {
    const tuesdayDawn = new Date(2026, 9, 27, 6, 0, 0);
    const specs = planNotifications({
      now: tuesdayDawn,
      prefs,
      horizonDays: 3,
      writtenDays: ['2026-10-27'],
      trainedDays: ['2026-10-27'],
    });
    expect(specs.some((s) => s.id === 'debt-2026-10-26')).toBe(false);
  });

  test('the alarm shows the count it will actually have when it fires', () => {
    const specs = planNotifications({
      now: new Date(2026, 10, 3, 12, 0, 0),
      prefs,
      horizonDays: 7,
      since: '2026-10-26',
      stake: 'Ten to the jar.',
    });
    /** Three from the ignored signing week, plus the ignored Monday and Wednesday. */
    const thursday = specs.find((s) => s.id === 'debt-2026-11-04')!;
    expect(thursday.body).toContain('5 pages unpaid');
    expect(thursday.body).toContain('Ten to the jar.');
    /** Friday's alarm was planned on Tuesday, before Wednesday was missed. */
    const saturday = specs.find((s) => s.id === 'debt-2026-11-06')!;
    expect(saturday.title).toBe('Never miss twice');
    expect(saturday.body).toContain('6 pages unpaid');
  });

  test('an alarm for yesterday does not count yesterday twice', () => {
    const tuesdayDawn = new Date(2026, 9, 27, 2, 0, 0);
    const specs = planNotifications({
      now: tuesdayDawn,
      prefs,
      horizonDays: 2,
      since: '2026-10-26',
    });
    const monday = specs.find((s) => s.id === 'debt-2026-10-26')!;
    expect(monday.body).toContain('1 page unpaid');
    expect(monday.body).not.toContain('2 pages unpaid');
  });

  test('a written day cancels its own alarm and leaves the others armed', () => {
    const specs = planNotifications({
      now: sundayMorning,
      prefs,
      horizonDays: 7,
      writtenDays: ['2026-10-26'],
    });
    expect(specs.some((s) => s.id === 'debt-2026-10-26')).toBe(false);
    expect(specs.some((s) => s.id === 'debt-2026-10-28')).toBe(true);
  });

  test('a repair in the same week stops the alarm claiming two in a row', () => {
    const specs = planNotifications({
      now: new Date(2026, 10, 3, 12, 0, 0),
      prefs,
      horizonDays: 7,
      since: '2026-10-26',
      /** Tuesday's floor session repaired the blank Monday. */
      writtenDays: ['2026-11-03'],
      trainedDays: ['2026-11-03'],
    });
    const thursday = specs.find((s) => s.id === 'debt-2026-11-04')!;
    /** Monday is repaired, so only Wednesday is behind; this is not two in a row. */
    expect(thursday.title).toBe('Yesterday went unwritten');
    expect(thursday.body).toContain('4 pages unpaid');
    /** By Saturday, Wednesday and Friday really are two in a row. */
    const saturday = specs.find((s) => s.id === 'debt-2026-11-06')!;
    expect(saturday.title).toBe('Never miss twice');
    expect(saturday.body).toContain('5 pages unpaid');
  });

  test('two appointments in a row are named as such', () => {
    const tuesdayMorning = new Date(2026, 9, 27, 9, 0, 0);
    const specs = planNotifications({
      now: tuesdayMorning,
      prefs,
      horizonDays: 7,
      since: '2026-10-26',
    });
    const wednesday = specs.find((s) => s.id === 'debt-2026-10-28')!;
    expect(wednesday.title).toBe('Never miss twice');
    expect(wednesday.body).toContain('Two appointments in a row');
  });

  test('only the next appointment carries the prescription', () => {
    const specs = planNotifications({
      now: sundayMorning,
      prefs,
      horizonDays: 7,
      brief: { text: 'Set 1 of A: split squat, 3 × 8, 15 kg each.' },
    });
    const anchors = specs.filter((s) => s.kind === 'anchor');
    expect(anchors[0]!.body).toContain('Set 1 of A');
    expect(anchors[1]!.body).not.toContain('Set 1 of A');
  });

  test('the 20:30 fallback opens the ten minute session, not the home page', () => {
    const specs = planNotifications({ now: sundayMorning, prefs, horizonDays: 7 });
    const fallback = specs.find((s) => s.kind === 'fallback')!;
    expect(fallback.data.route).toBe('/session?kind=floor');
    const anchor = specs.find((s) => s.kind === 'anchor')!;
    expect(anchor.data.route).toBe('/');
  });

  test('a booked repair lands at the booked time and opens the floor session', () => {
    const specs = planNotifications({
      now: new Date(2026, 10, 6, 18, 0, 0),
      prefs,
      horizonDays: 7,
      repair: { day: '2026-11-07', hour: 19, minute: 0 },
    });
    const repair = specs.find((s) => s.kind === 'repair')!;
    expect(repair.at.getDate()).toBe(7);
    expect(repair.at.getHours()).toBe(19);
    expect(repair.data.route).toBe('/session?kind=floor');
    expect(repair.body).toContain('Ten minutes');
  });

  test('a repair is not armed on an appointment day or after the page is written', () => {
    const onAppointment = planNotifications({
      now: new Date(2026, 10, 5, 18, 0, 0),
      prefs,
      horizonDays: 7,
      repair: { day: '2026-11-06', hour: 19, minute: 0 },
    });
    expect(onAppointment.some((s) => s.kind === 'repair')).toBe(false);

    const written = planNotifications({
      now: new Date(2026, 10, 6, 18, 0, 0),
      prefs,
      horizonDays: 7,
      repair: { day: '2026-11-07', hour: 19, minute: 0 },
      writtenDays: ['2026-11-07'],
    });
    expect(written.some((s) => s.kind === 'repair')).toBe(false);
  });

  test('a repair whose hour has passed is not scheduled', () => {
    const specs = planNotifications({
      now: new Date(2026, 10, 7, 20, 0, 0),
      prefs,
      horizonDays: 3,
      repair: { day: '2026-11-07', hour: 19, minute: 0 },
    });
    expect(specs.some((s) => s.kind === 'repair')).toBe(false);
  });

  test('starting the repair cancels the alarm that would nag afterwards', () => {
    const specs = planNotifications({
      now: new Date(2026, 10, 7, 18, 0, 0),
      prefs,
      horizonDays: 3,
      repair: { day: '2026-11-07', hour: 19, minute: 0 },
    });
    const repair = specs.find((s) => s.kind === 'repair')!;
    const remaining = cancelAfterStart(specs, new Date(repair.at.getTime() - 5 * 60_000));
    expect(remaining.some((s) => s.kind === 'repair')).toBe(false);
  });

  test('starting a session cancels the fallback that would nag afterwards', () => {
    const specs = planNotifications({ now: sundayMorning, prefs, horizonDays: 7 });
    const firstAnchor = specs.find((s) => s.kind === 'anchor')!;
    const start = new Date(firstAnchor.at.getTime() + 5 * 60_000);
    const remaining = cancelAfterStart(specs, start);
    expect(remaining.some((s) => s.kind === 'fallback' && s.id === `fallback-${firstAnchor.id.slice(7)}`)).toBe(false);
    expect(remaining.some((s) => s.kind === 'anchor' && s.id === firstAnchor.id)).toBe(true);
  });
});

describe('the copy is true when it lands', () => {
  test('the anchor fires on the appointment, not before it', () => {
    const specs = planNotifications({ now: sundayMorning, prefs, horizonDays: 3 });
    const anchor = specs.find((s) => s.kind === 'anchor')!;
    expect(anchor.at.getHours()).toBe(19);
    expect(anchor.at.getMinutes()).toBe(0);
    for (const spec of specs) {
      expect(spec.title).not.toMatch(/minutes away|minutes left/i);
    }
  });

  test('a tap lands on the page that answers it, and never carries a guessed key', () => {
    const specs = planNotifications({
      now: sundayMorning,
      prefs,
      horizonDays: 7,
      repair: { day: '2026-10-27', hour: 19, minute: 0 },
    });
    const anchor = specs.find((s) => s.kind === 'anchor')!;
    const fallback = specs.find((s) => s.kind === 'fallback')!;
    const review = specs.find((s) => s.kind === 'review')!;
    const debt = specs.find((s) => s.kind === 'debt')!;
    const repair = specs.find((s) => s.kind === 'repair')!;
    expect(anchor.data.route).toBe('/');
    expect(fallback.data.route).toBe('/session?kind=floor');
    /** The page reads the rotation when it opens; a projected key would lie after a skip. */
    expect(fallback.data.route).not.toMatch(/key=/);
    expect(review.data.route).toBe('/review');
    expect(debt.data.route).toBe('/session?kind=floor');
    expect(repair.data.route).toBe('/session?kind=floor');
  });
});
