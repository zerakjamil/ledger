# Baseline

The first fourteen days are calibration, and the first hour is measurement. Do it
before the first session. Numbers taken after a workout, after a salty dinner, or
from memory are not numbers.

## Day 0, one sitting

| Measure | How | Written as |
|---|---|---|
| Waist | Tape at the navel, standing, breathe out, do not suck in. Three readings, take the middle. | 96.0 cm |
| Weight | Morning, after the bathroom, before food. | 90.0 kg |
| Waist photo | Front and side, same spot, same light, phone at navel height. | two files, day 0 |
| Resting pulse | Sitting, after five quiet minutes. Optional. | 62 bpm |

Why the waist and not the scale: at 175 cm and 90 kg, the scale moves with
water, salt, and yesterday's dinner. The waist moves with fat. The app tracks
both and only ever asks you to act on one at a time.

Take the photos. They are the only measurement that survives a bad week, and in
week eight they are the only thing that will feel like evidence.

## The fourteen-day calibration

The first two sessions are not training. They are load finding. Pick weights you
could leave three or four reps in reserve with, not two. The engine starts each
movement at the bottom of its rep window and the lightest buildable load; the
calibration sets teach it what your floor actually is. It will spend two weeks
climbing back to a real effort and refusing to rush.

Do not add weight to look strong. A movement that starts too heavy stalls in week
three, and a stall is two weeks of no progress plus a deload.

At the end of fourteen days:

- Every movement has a load, a rep target, and a stall count.
- There are six sessions on the page. If there are fewer, that is the finding:
  the contract days are wrong, not your character.
- Your waist has one reading. It will get its second on day 14.

## The floor, every day

Two things, no food diary:

- **8,000 steps.** Not cardio, not a class. Walking. It is the cheapest lever
  that does not touch recovery.
- **140 g of protein.** Roughly 1.5 g per kilo. It is the only nutrition target
  in the app, because it is the only one that changes body composition while
  training in a deficit.

You log the floor once a week, with a tap. Not daily.

## What a working week looks like

| Week | Waist | Weight, 7-day average | Strength |
|---|---|---|---|
| 1–2 | flat | flat or +0.5 kg | loads being found |
| 3–4 | −0.5 to −1 cm | −0.2 to −0.4 kg/week | reps climbing |
| 5–8 | −1 to −2 cm | −0.3 to −0.5 kg/week | first ADD LOAD stamps |
| 9–12 | −2 to −4 cm | same slope | levers starting on dumbbells |

A rate faster than 1 kg a week is not better. The app will tell you to eat more,
and it means it: losing strength to lose fat is the wrong trade.

The scale will lie to you for three to five days at a time. That is why the app
shows a seven day average and a slope, never the morning's number.

## When the waist stops moving

The app gives you exactly one change a week, chosen in this order:

1. **Sessions short of target?** Fix the schedule, not the effort.
2. **A repeated skip reason?** Move the anchor time. A 7pm session that keeps
   dying at 7pm needs to be a 6am session, not more willpower.
3. **Fewer than seven weight readings?** Collect before concluding anything.
4. **Average flat for two weeks?** Add 1,500 steps a day. Do not touch food.
5. **Losing more than 1 kg/week?** Add a portion at dinner.

One change. Never three. Three changes is a new program, and a new program in
week three is how people quit.

## What "adherence" means here

Three sessions a week, not seven. Two skip tokens a month, no questions asked,
and the run survives them. A missed week does not reset the days you have
already written; it only resets the run.

The week is the unit. A Tuesday that goes wrong is absorbed by a Thursday. The
only thing that breaks the streak is two unexplained skips in a row, and even
then the ledger keeps every line.

## Files

- `docs/PROGRAM.md` the sessions, the progression rules, the purchase order.
- `src/domain/` the implementation, with tests beside every rule.
- Settings, then **Ledger and export** writes the whole event log as plain JSON.
  That file is the backup. There is no account and no server holding a copy.
