import { describe, expect, test } from 'bun:test';
import { reduceEvents, type AppEvent, type Contract } from './state';
import { widgetModel } from './widget';

const contract: Contract = {
  days: [1, 3, 5],
  hour: 19,
  minute: 0,
  ifText: 'when it is 7pm I put on shoes',
  reward: 'one chapter',
  stake: 'twenty to the jar',
  createdAt: '2026-10-01T18:00:00',
};

const sign = (overrides: Partial<Contract> = {}): AppEvent => ({
  type: 'contract.set',
  at: contract.createdAt,
  day: '2026-10-01',
  payload: { ...contract, ...overrides } as unknown as Record<string, unknown>,
});

const finish = (
  day: string,
  key: 'A' | 'B' | 'C' = 'A',
  kind: 'full' | 'floor' = 'full',
): AppEvent => ({
  type: 'session.finish',
  at: `${day}T19:00:00`,
  day,
  payload: { key, kind, results: {} },
});

const skip = (day: string, protectedSkip = false): AppEvent => ({
  type: 'skip',
  at: `${day}T19:00:00`,
  day,
  payload: { reason: 'work', protected: protectedSkip },
});

const book = (bookedOn: string, day: string, hour = 19, minute = 0): AppEvent => ({
  type: 'repair.book',
  at: `${bookedOn}T20:00:00`,
  day: bookedOn,
  payload: { day, hour, minute },
});

/** Local wall clock, so rotation hours match the times written in the fixtures. */
function local(day: string, hour = 9, minute = 0): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, m! - 1, d!, hour, minute, 0, 0);
}

function view(events: AppEvent[], day: string, hour = 9, minute = 0) {
  const state = reduceEvents(events, day);
  return { state, model: widgetModel(state, local(day, hour, minute)) };
}

describe('the widget before the contract', () => {
  test('asks for the appointment, not for a login', () => {
    const { model } = view([], '2026-11-02');
    expect(model.mode).toBe('sign');
    expect(model.count).toBe('THREE A WEEK');
    expect(model.action?.uri).toBe('ledger:///onboarding');
    expect(model.secondary).toBeNull();
  });
});

describe('a training day', () => {
  test('the first page is named as a first page', () => {
    const { model } = view([sign()], '2026-11-02');
    expect(model.mode).toBe('train');
    expect(model.headline).toBe('The first page.');
    expect(model.detail).toBe('Session A · 4 movements');
    expect(model.action?.label).toBe('START SESSION');
    expect(model.action?.uri).toBe('ledger:///session?kind=full');
  });

  test('the appointment time becomes the morning, afternoon or evening sentence', () => {
    const previous = finish('2026-10-30', 'B');
    expect(view([sign({ hour: 7 }), previous], '2026-11-02', 6).model.headline).toBe(
      'This morning, 07:00',
    );
    expect(view([sign({ hour: 13 }), previous], '2026-11-02', 12).model.headline).toBe(
      'This afternoon, 13:00',
    );
    expect(view([sign({ hour: 19 }), previous], '2026-11-02', 18).model.headline).toBe(
      'Tonight, 19:00',
    );
  });

  test('after the appointment it stops claiming the time is still ahead', () => {
    const previous = finish('2026-10-30', 'B');
    const late = view([sign(), previous], '2026-11-02', 20);
    expect(late.model.mode).toBe('train');
    expect(late.model.headline).toBe('The page is still blank.');
    expect(late.model.detail).toBe('The 19:00 appointment has passed.');
    expect(late.model.action?.label).toBe('START SESSION');
    expect(late.model.tone).toBe('rust');
  });

  test('after the fallback window the ten minutes lead', () => {
    const previous = finish('2026-10-30', 'B');
    const late = view([sign(), previous], '2026-11-02', 21);
    expect(late.model.mode).toBe('train');
    expect(late.model.headline).toBe('Ten minutes.');
    expect(late.model.detail).toBe(
      'The appointment has passed. Ten minutes still counts.',
    );
    expect(late.model.action?.label).toBe('TEN MINUTES');
    expect(late.model.action?.uri).toBe('ledger:///session?kind=floor');
    expect(late.model.secondary?.uri).toBe('ledger:///session?kind=full');
  });

  test('a first session in a week already short is called short, not first', () => {
    const laterContract = sign({ createdAt: '2026-10-26T15:34:00' });
    const { model } = view([laterContract], '2026-10-28', 12);
    expect(model.mode).toBe('short');
    expect(model.headline).toBe('1 page short.');
    expect(model.detail).toBe('One session closes the gap.');
    expect(model.action?.label).toBe('START THE SESSION');
    expect(model.countTone).toBe('rust');
  });

  test('the ten minute version is always the second tap', () => {
    const { model } = view([sign()], '2026-11-02');
    expect(model.secondary?.label).toBe('TEN MINUTES');
    expect(model.secondary?.uri).toBe('ledger:///session?kind=floor');
  });
});

describe('a page already written', () => {
  test('closes the day and names the next appointment', () => {
    const { model } = view([sign(), finish('2026-11-02')], '2026-11-02', 21);
    expect(model.mode).toBe('written');
    expect(model.headline).toBe('Written.');
    expect(model.detail).toBe('Next page WED 19:00');
    expect(model.action).toBeNull();
    expect(model.secondary?.uri).toBe('ledger:///');
  });

  test('does not offer a second session on a closed day', () => {
    const { model } = view([sign(), finish('2026-11-02')], '2026-11-02', 21);
    expect(model.action).toBeNull();
  });
});

describe('the week counted from the pages themselves', () => {
  test('says whole and turns moss only when three pages are in', () => {
    const { model } = view(
      [sign(), finish('2026-11-02'), finish('2026-11-04', 'B'), finish('2026-11-06', 'C')],
      '2026-11-08',
    );
    expect(model.mode).toBe('whole');
    expect(model.count).toBe('3 / 3 PAGES');
    expect(model.tone).toBe('moss');
    expect(model.countTone).toBe('moss');
    expect(model.action).toBeNull();
  });

  test('counts an extra page instead of clamping it', () => {
    const { model } = view(
      [
        sign(),
        finish('2026-11-02'),
        finish('2026-11-04', 'B'),
        finish('2026-11-06', 'C'),
        finish('2026-11-07', 'A'),
      ],
      '2026-11-08',
    );
    expect(model.mode).toBe('whole');
    expect(model.count).toBe('4 / 3 PAGES');
  });

  test('re-reads the week rather than a stale snapshot of it', () => {
    /** The snapshot was computed on Sunday, before Monday's page existed. */
    const state = reduceEvents([sign(), finish('2026-11-02')], '2026-11-01');
    expect(state.consistency.sessionsThisWeek).toBe(0);

    const model = widgetModel(state, local('2026-11-02', 21));
    expect(model.count).toBe('1 / 3 PAGES');
  });
});

describe('a week that is behind', () => {
  test('the last day with no appointment left becomes the ten minute offer', () => {
    const { model } = view(
      [sign(), finish('2026-11-02'), finish('2026-11-04', 'B')],
      '2026-11-07',
    );
    expect(model.mode).toBe('short');
    expect(model.headline).toBe('One page short.');
    expect(model.detail).toBe('Ten minutes closes the week.');
    expect(model.count).toBe('2 / 3 PAGES');
    expect(model.action?.label).toBe('TEN MINUTES');
    expect(model.action?.uri).toBe('ledger:///session?kind=floor');
    expect(model.secondary?.uri).toBe('ledger:///session?kind=full');
    expect(model.countTone).toBe('rust');
  });

  test('an appointment still ahead is a makeup session, not a rescue', () => {
    const { model } = view([sign(), finish('2026-11-02')], '2026-11-05');
    expect(model.mode).toBe('short');
    expect(model.headline).toBe('1 page short.');
    expect(model.detail).toBe('One session closes the gap.');
    expect(model.action?.label).toBe('START THE SESSION');
  });
});

describe('the booked repair', () => {
  const base = [
    sign(),
    finish('2026-11-02'),
    finish('2026-11-04', 'B'),
    skip('2026-11-06'),
    book('2026-11-06', '2026-11-07'),
  ];

  test('outranks the gap it was booked to close', () => {
    const { model } = view(base, '2026-11-06', 21);
    expect(model.mode).toBe('booked');
    expect(model.headline).toBe('Repair booked.');
    expect(model.detail).toBe('SAT 19:00 · one floor session.');
    expect(model.action).toBeNull();
    expect(model.tone).toBe('rust');
  });

  test('on the day it is ten minutes, one tap', () => {
    const { model } = view(base, '2026-11-07');
    expect(model.mode).toBe('repair');
    expect(model.headline).toBe('Ten minutes.');
    expect(model.detail).toBe('Today, 19:00. The page you skipped.');
    expect(model.action?.label).toBe('START THE REPAIR');
    expect(model.action?.uri).toBe('ledger:///session?kind=floor');
  });

  test('closes the week when the repair is written', () => {
    const { model } = view([...base, finish('2026-11-07')], '2026-11-07', 21);
    expect(model.mode).toBe('whole');
    expect(model.count).toBe('3 / 3 PAGES');
    expect(model.tone).toBe('moss');
    expect(model.action).toBeNull();
  });
});

describe('a rest day', () => {
  test('says nothing to lift and points at the next page', () => {
    const { model } = view([sign(), finish('2026-11-02')], '2026-11-03', 20);
    expect(model.mode).toBe('rest');
    expect(model.headline).toBe('Nothing to lift.');
    expect(model.detail).toBe('Next page WED 19:00');
    expect(model.action).toBeNull();
  });

  test('inside twenty hours it says when the page opens, not to lift anyway', () => {
    const { model } = view([sign(), finish('2026-11-02')], '2026-11-03', 9);
    expect(model.mode).toBe('rest');
    expect(model.detail).toBe('The page opens at 15:00');
  });
});

describe('a skipped day', () => {
  test('is called skipped, not written, and points at the next page', () => {
    const { model } = view([sign(), skip('2026-11-02')], '2026-11-02', 21);
    expect(model.mode).toBe('skipped');
    expect(model.headline).toBe('Skipped.');
    expect(model.detail).toBe('The skip is written. Next page WED 19:00');
    expect(model.action).toBeNull();
    expect(model.count).toBe('0 / 3 PAGES');
    expect(model.tone).toBe('rust');
    expect(model.countTone).toBe('rust');
  });

  test('a token is named as a token, not a page', () => {
    const { model } = view([sign(), skip('2026-11-02', true)], '2026-11-02', 21);
    expect(model.headline).toBe('Token spent.');
    expect(model.detail).toBe('The skip is written. Next page WED 19:00');
  });

  test('does not re-offer the ten minutes the skip page already offered', () => {
    const { model } = view(
      [sign(), finish('2026-11-02'), finish('2026-11-04'), skip('2026-11-07')],
      '2026-11-07',
      21,
    );
    expect(model.mode).toBe('skipped');
    expect(model.headline).toBe('The week closed short.');
    expect(model.detail).toBe(
      'The skip is written. No appointment is left to make it whole.',
    );
    expect(model.action).toBeNull();
    expect(model.countTone).toBe('rust');
  });
});

describe('a page written after the week is already lost', () => {
  const events = [
    sign(),
    finish('2026-11-02'),
    skip('2026-11-04'),
    skip('2026-11-06'),
    finish('2026-11-07', 'B'),
  ];

  test('says the week closed short and offers no tap that cannot help', () => {
    const { model } = view(events, '2026-11-07', 21);
    expect(model.mode).toBe('short');
    expect(model.headline).toBe('The week closed short.');
    expect(model.count).toBe('2 / 3 PAGES');
    expect(model.action).toBeNull();
    expect(model.tone).toBe('rust');
  });
});

describe('the deep links the widget owns', () => {
  test('every action lands on a route the app can open', () => {
    const models = [
      view([], '2026-11-02').model,
      view([sign()], '2026-11-02').model,
      view([sign(), finish('2026-11-02'), finish('2026-11-04', 'B')], '2026-11-07').model,
      view([sign(), finish('2026-11-02')], '2026-11-02', 21).model,
    ];
    for (const model of models) {
      for (const action of [model.action, model.secondary]) {
        if (!action) continue;
        expect(action.uri.startsWith('ledger:///')).toBe(true);
      }
    }
  });
});
