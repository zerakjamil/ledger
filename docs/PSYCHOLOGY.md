# The psychology, and where it lives

The rule for this file: a mechanism earns its place only if it changes a decision
the user would otherwise make differently. Anything that only decorates the
ledger gets cut, however good it looks on a slide.

## The four laws, applied

| Law | What the app actually does | Where |
|---|---|---|
| Make it obvious | A written appointment with a time and a place, two alarms on the day, and a lock screen that names the first movement and its load. | `onboarding.tsx`, `notifications.ts`, `brief.ts` |
| Make it attractive | The reward is chosen at signing, shown on the home page before set 1 as the thing that session unlocks, and paid on the summary screen. Not in a settings page. | `onboarding.tsx`, `index.tsx`, `session.tsx` |
| Make it easy | A ten minute version that counts in full, "the deal is set 1", reps and RIR pre-filled, one tap to log a set. | `session.tsx`, `index.tsx` |
| Make it satisfying | The progression is decided and stamped immediately, the page count only goes up, and the reward is unlocked. | `session.tsx`, `log.tsx` |

## The mechanisms that run while the app is closed

This is the part that makes "install it and forget it" true.

**The morning-after alarm.** Every training day gets an 08:00 alarm for the next
morning. It is not cancelled by a tap. It is cancelled by a written line: a
session, a floor session, or a skip you actually confessed to. If you ignore the
phone, the alarm arrives before the next appointment, while the week can still be
saved. Two missed appointments in a row escalate the copy to "Never miss twice"
(`notifications.ts`, `debt.ts`).

**The prescription on the lock screen.** The first upcoming alarm does not say
"train tonight". It says `Set 1 of B: barbell overhead press, 3 × 8, 20 kg`. The
phone already knows the load, so the reminder removes the reason to open the app
and check (`brief.ts`). Later alarms stay generic on purpose: a week of
prescriptions projected forward would be a guess the moment one appointment
moves, and a reminder that lies about the weight is worse than a vague one.

**Reminders open the work, not a menu.** The 20:30 fallback and the 08:00 debt
alarm do not open the home page and ask the user to find the ten minute version.
They open the ten minute session itself, with the rotation read at that moment,
so the weakest hour of the day costs one decision instead of three
(`notifications.ts`, `session.tsx`).

**The queue is rebuilt from evidence.** Every open, every finished session and
every written skip cancels the whole queue and rebuilds it from the current
ledger (`services/notifications.ts`, `provider.tsx`). Nothing is remembered by
the notification system that the ledger does not still believe.

## The page on the home screen

A reminder can be dismissed without a decision. A widget is looked at while the
phone is already in the hand. The Android widget is not a dashboard, and it does
not show a streak. It answers one question in one sentence: what does today ask,
and what does the week still owe? (`src/domain/widget.ts`). Because it is
rendered from the same event log as the app, it cannot congratulate a week the
ledger calls short, and it cannot offer ten minutes on a day that already has a
page, because a second page that day would not count.

The widget changes four decisions:

- **The appointment is ambient.** Before the app is opened, the home screen
  names the next session, the hour, and the session letter. The first tap opens
  the session, not the home page.
- **The ten minute version is one tap, on the only day it can save the week.**
  It appears when `lastChance` is true, not as a permanent escape hatch on every
  other day.
- **A plan outranks a debt.** A booked repair replaces "one page short" with
  "repair booked", because the user has already made the decision. Repeating the
  debt would bill them twice.
- **A lost week is said once.** On a day already written, with no appointment
  left and a shortfall the page cannot repair, the widget says "The week closed
  short" and offers no tap. A red "one page short" that survives every unlock
  would be nagging without a way to act.

The count is pages, never days in a row: `2 / 3 PAGES`, `3 / 3 PAGES`. There is
no flame to protect and no reset to fear. The widget turns moss only when the
week is actually whole, and rust only when the week is actually behind.

Two sentences have to stay true as the day moves. Before the appointment the
widget names the hour (`Tonight, 19:00`). After it, saying that would be a claim
about the future that is already false, so the page admits `The page is still
blank.` and names the hour that has passed. Once the app's ninety minute
fallback window is gone, the ten minute version becomes the primary action, not
the footnote. The weakest hour of the day should cost one decision, and the home
screen is where that decision is made.

A skip is written down, but it is not a page. The widget says `Skipped.` or
`Token spent.`, never `Written.`, and it does not re-offer the repair the skip
page already offered. A ledger that calls a skip a written page would be
flattering the user at the exact moment it should be honest.

Widgets are image-rendered by the launcher, so the page uses system serif, sans
and mono families and the same paper palette as the app. The app writes the
widget whenever the ledger changes and when it returns to the foreground; the
launcher also refreshes it once a day. No network, no account, no background
sync. The widget reads the same SQLite file the app writes, or it invites the
user into the ledger instead of showing a stale number.

## Loss aversion, at the only moment it works

The stake is written at signing, so it is shown at the point of decision, on the
skip page, not buried in settings. The reward appears on the same page, as the
thing the skip leaves locked, so the choice is a trade rather than a refusal.
Two shapes for the price:

- With a token left: *"A token covers it. Without one, the price you wrote is: …"*
- With no tokens: *"The price is due: … This makes 7 pages unpaid."*

The count includes **silence**, not just confessed skips. A ledger that only
counts the skips you were brave enough to write down flatters you: the most
common way to miss a session is to never open the app. `debts.ts` counts the
appointment, not the confession.

**The alarm counts what it will see when it fires, not what the phone knew when
it was planned.** A phone that is never opened never rebuilds its queue, so a
count frozen on the day of planning would understate the debt exactly when the
user has stopped looking. The 08:00 alarm projects every appointment between
planning day and the morning it fires, and projects the "Never miss twice"
escalation the same way. It runs the same repair-aware ledger as the log
(`noShowDays`), so a Monday that was repaired by a Tuesday session is not
counted as a second miss. A session rebuilds the queue and resets the guess, so
the estimate can only be wrong in the safe direction.

But an alarm that offers ten minutes has to be telling the truth. A session on
another day in the same week buys the blank appointment back, so the morning
repair really does take one page off the ledger. It takes one, not all of them,
so the copy says "ten minutes still counts" rather than promising to clear a
backlog. A written skip is different: it was a
decision with a price attached, and making the page up later does not unmake the
decision. That asymmetry is deliberate. Silence is a lapse and is repairable;
a skip with a stated reason is a choice and is priced.

Skip tokens are deliberately scarce: two a month, and using one requires a
reason. A token keeps the run and covers the price. It does not write a page:
the week's three pages are still three pages, so a token is a pass on the
streak, not a pass on the work. The reason becomes next week's advice ("Move the
anchor, not the willpower"), so the escape hatch produces information instead of
guilt.

## A skip ends with a plan, not a bill

The dangerous moment is not the missed session. It is the hour after the app has
been honest about it: the price is written, the reward is gone, and the next
appointment can be six days away. That is where the abstinence violation effect
lives. One lapse becomes a lost week because the ledger has nothing left to ask
for until Monday.

So the skip page does not end at the price. When the confession itself leaves
the week exactly one page short and no appointment is left to write it, the page
offers the ten minute repair before it closes the day (`repair.ts`,
`skip.tsx`). Booking writes the skip and the repair in one commit, and arms one
alarm at the booked minute that opens the floor session itself. The user does
not have to remember the promise, and the app does not get to make it on the
user's behalf.

The offer is deliberately narrow, because a rescue that overpromises is worse
than no rescue:

- **Exactly one page.** Never "clear the backlog". One ten minute session buys
  one page, so that is the only debt it is allowed to mention.
- **No appointment left.** If Friday is still ahead, Friday is the repair. An
  extra session on top of the contract is not a rescue, it is a second job.
- **Still inside the week.** On Sunday night the week is over. The app says so
  and lets the page stay short rather than selling a session that cannot count.
- **Floor only.** The repair writes the page and never moves a weight, so it
  cannot be used to fake progress. The skip stays written either way; the
  repair buys the page back, not the decision.

The same arithmetic runs on the home page. On the last day the week can still
be saved, the ten minute version is the primary action and the full session is
the quiet alternative. This is not a reward for being behind. It is the
implementation intention from signing ("when it is 7pm I put on shoes") applied
to the only hour where it still changes the week's outcome.

The repair also expires on its own: after the day, when a session is written,
when the contract moves an appointment onto that day, or when a second skip
makes one session insufficient (`activeRepair`). A reminder for a promise the
ledger no longer believes is worse than no reminder. Cancelling is possible
where the promise is shown, behind a confirmation, and the copy says plainly
that the page stays short.

## The page is written by the work, not by a second tap

The last set writes the page. The summary used to render before the database
row existed, which meant a phone that died between the final rep and the
*Close the page* button lost the session, and the summary said "written" while
the ledger was still empty. Now the write happens at the moment the work ends,
the summary is a receipt rather than a form, and an empty page cannot be
written at all: *Finish early* with zero sets refuses and leaves.

That ordering matters beyond data loss. A reward that arrives only after a
second confirmation is a form. A reward that arrives at the end of the last set
is a payment. The same rule governs the widget: it can only ever show a page
that already exists in SQLite, because it reads the same file.

## Identity, counted rather than declared

There are no affirmations. The log says one true sentence: *"Every page is a
vote. You have cast 14."* That is the identity mechanism from Atomic Habits
reduced to arithmetic the ledger can actually defend. The number never resets,
which is why a bad week cannot erase it.

## The rules that prevent the usual failure modes

- **The week, not the streak.** Three pages a week, measured against the
  appointments that have already gone by. Rest days never count against you. A
  missed Tuesday becomes "one page short", not a broken chain. The what-the-hell
  effect lives exactly at the end of a broken chain, so there is no chain to
  break.
- **A page written late is a page.** A Tuesday session absorbs a blank Monday,
  because the contract promises three pages, not three dates. Without this, a
  recovered week would keep asking for make-up sessions and the app would nag
  exactly when the user had already done the work.
- **Never miss twice.** The morning-after alarm exists for the second miss, not
  the first. One miss is life. Two is a new pattern.
- **One day, one page.** The strongest entry wins. A floor session after a full
  session does not inflate the week.
- **One change a week.** The review produces exactly one adjustment, and a
  self-reported miss outranks the app's request for more data.
- **The two-minute rule.** "The deal is set 1. The other sets are yours to
  take." The ten minute version counts at full value but never moves load, so
  the emergency exit cannot be used to fake progress.

## What is deliberately missing

- **No streak that resets.** See above.
- **No points, badges, levels or leaderboards.** They reward using the app, not
  training.
- **No calorie tracker, no meal log.** The app would be lying about what it can
  see. The only nutrition input is one weekly tap: 140 g protein, yes or no.
- **No social feed, no sharing.** There is no account and no network permission.
  The only export is a JSON file the user owns.
- **No motivational quotes.** The user's own contract sentence is the only
  motivation in the app, and it is shown verbatim.

## The honest limit

None of this creates a calorie deficit. The training builds and keeps muscle,
the weekly waist reading tells the truth, and the one-change rule stops the user
from guessing. Fat loss still happens in the kitchen, and the app does not look
at the kitchen. The psychology above removes the two failure modes it can reach:
not starting, and not noticing. It cannot remove eating past a deficit.

## References behind the mechanisms

- Gollwitzer, P. M. & Sheeran, P. (2006). Implementation intentions and goal
  achievement: a meta-analysis of effects and processes.
- Milkman, K. L., Minson, J. A. & Volpp, K. G. M. (2014). Holding the Hunger
  Games hostage at the gym: the effect of temptation bundling on exercise.
- Dai, H., Milkman, K. L. & Riis, J. (2014). The fresh start effect.
- Marlatt, G. A. & Gordon, J. R. (1985). *Relapse prevention*: the abstinence
  violation effect, and why one lapse turns into a lost week when the plan ends
  at the lapse.
- Clear, J. (2018). *Atomic Habits*: the two-minute rule, never miss twice, and
  identity votes.
