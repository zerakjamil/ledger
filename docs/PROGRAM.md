# The program

This is the manual for what the app does. Every rule below is implemented in
`src/domain/` and covered by tests. If the app and this page disagree, the app is
right and this page is a bug.

## The constraint

The room has a bench, a 10 kg bar, 30 kg of plates, and two 15 kg dumbbells. No
rack, no pull-up bar, nothing that hurts.

That is enough for the legs and the back, and it is not enough for the barbell.
A 30 kg ceiling means a barbell squat tops out at a warm-up weight. So:

- **Dumbbells carry the strength work.** Split squat, row, bench, Romanian
  deadlift. Unilateral loading is how 15 kg per hand becomes a hard set.
- **The bar carries the press and the hinge**, where 30 kg is still a real
  stimulus, plus density work once the reps run out.
- **The carry and the plank carry the trunk**, because a 90 kg body with a
  visible waist does not need more crunches.

## The three sessions

| | Session A, squat and pull | Sets × reps | Load |
|---|---|---|---|
| 1 | Rear-foot-elevated split squat | 3 × 8–12 | 2 × 15 kg |
| 2 | Single-arm dumbbell row | 3 × 10–15 | 15 kg |
| 3 | Dumbbell bench press | 3 × 10–15 | 2 × 15 kg |
| 4 | Suitcase carry | 3 × 30–45 s | 15 kg |

| | Session B, press and push | Sets × reps | Load |
|---|---|---|---|
| 1 | Barbell overhead press | 3 × 8–12 | bar, 10 kg up |
| 2 | Feet-elevated push-up | 3 × 6–15 | bodyweight |
| 3 | Barbell front squat | 3 × 12–20 | bar, 10 kg up |
| 4 | Front plank | 3 × 30–60 s | bodyweight |

| | Session C, hinge and carry | Sets × reps | Load |
|---|---|---|---|
| 1 | Single-leg Romanian deadlift | 3 × 10–12 | 15 kg |
| 2 | Barbell hip thrust | 3 × 12–15 | bar, 10 kg up |
| 3 | Single-arm dumbbell row | 3 × 10–15 | 15 kg |
| 4 | Dead bug | 3 × 6–10 | bodyweight |

Pattern coverage across the week: squat (A1, B3), hinge (C1, C2), horizontal
push (A3, B2), horizontal pull (A2, C3), vertical push (B1), carry (A4), core
(B4, C4). Vertical pull is the one hole, and it is the first thing to buy your
way out of.

### The floor session

Ten minutes, three movements, two sets each: split squat, row, feet-elevated
push-up.

It counts for the week exactly like a full session. It does not move a load. The
purpose is to make "I have ten minutes" a real answer instead of a reason to
skip, and to keep the run alive on a bad day.

## Progression

Double progression with three levers, applied in this order:

1. **Reps.** Every set hits the target at RIR 2 or harder, so the target goes up
   by one rep (five seconds on a timed hold).
2. **Load.** At the top of the rep window, the next buildable load. The jump must
   be no larger than 10% of the current load, or 2.5 kg, whichever is larger.
3. **Sets.** If no buildable load is close enough, a fourth set instead. Reps
   reset to the bottom of the window.
4. **Lever.** If the sets are maxed and the plates have nothing left, the
   movement changes quality: a three-second descent, a pause, a density block.
   Each movement has its own list.
5. **Maxed.** Everything this kit can do is done. The screen says so and names
   the purchase that unlocks the next step.

The rules that hold it back:

| Situation | What happens |
|---|---|
| Fewer sets than prescribed | Hold. Nothing moves. |
| Any rep below target | Hold, and count a stall. |
| Two stalls in a row | Deload: one load step down, reps back to the bottom. |
| Any set at RIR 0 | Hold, stalls reset. Grinding is not a stimulus. |
| A load jump above the limit | Refused. Reps and sets climb instead. |

### The increment table

| Loading | Smallest step | Consequence |
|---|---|---|
| Barbell | 2.5 kg (a 1.25 kg pair) | 10 → 12.5 → 15 → 17.5 → 20 → 22.5 → 25 → 27.5 kg |
| Dumbbells | none, one fixed pair | reps, sets, tempo, and one-arm variants carry all progress |
| Bodyweight | none | reps, then single-limb or deficit variants |
| Timed holds | 5 s | 30 → 35 → 40 → 45 → 50 → 55 → 60 s |

The 2.5 kg floor exists because a 10 kg bar has no 10% step. The engine will take
a 2.5 kg jump from 10 kg even though it is 25%, because the alternative is a
program that cannot progress at all at the bottom.

## Reading the stamps

At the end of a session every movement gets one:

- **ADD REP** the usual case. Same load, one more rep.
- **ADD LOAD** heavier next time, reps restart at the bottom.
- **ADD SET** a fourth set, because the next plate is too far.
- **NEW LEVER** same weight, harder version.
- **HOLD** the plan did not earn a change.
- **SAVED** a partial session. The run keeps, the load does not move.
- **DELOAD** two misses in a row.
- **MAXED** this kit is finished for this movement.

## What to buy, in order

1. **A doorway pull-up bar.** It closes the only missing pattern and gives the
   back a vertical pull.
2. **2 × 10 kg and 2 × 5 kg plates.** The dumbbells stop at 15 kg; plate-loadable
   dumbbell handles extend the four heaviest movements by years.
3. **A band set.** Face pulls and rows, and it makes the press lockout honest.

Nothing else. A rack and a 200 kg barbell set are not the constraint.

## Why the rotation is not a weekday

Sessions are A, B, C in order, at least twenty hours apart. The contract names
the days; the rotation names the session. Missing a Tuesday does not shift the
program, and training twice in a day does not count as discipline.

If a contract day goes by unwritten, the next available day is offered as a
make-up. One session closes the gap, not two.
