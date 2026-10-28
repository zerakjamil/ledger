# Putting it on the phone

The file is `dist/ledger-1.0.0-arm64.apk` (32 MB, arm64, Android 7.0 and up,
sha256 `eb90490c9a3d1cec47503e3aa07b46d0a2dc45e042aef6df0ce06b645781fdf6`). It is
a release build: the JavaScript is bundled, Metro is not needed, and it runs with
the phone in aeroplane mode.

## Install

By cable:

```
adb install -r dist/ledger-1.0.0-arm64.apk
```

Without a cable: copy the file to the phone, tap it, allow install from that app
(Files or Chrome) when Android asks. It is signed with the local debug keystore,
so Play Protect may say "unsafe app blocked". Choose **Install anyway**. This
build is for one phone, not for the store.

## First launch

1. The cover page. Tap **Write the contract**.
2. The five parts. Change the plate pairs if they are not 5 / 2.5 / 1.25 kg per
   side; the app will refuse any weight it cannot build.
3. Allow notifications when Android asks. If the prompt was dismissed, Settings
   inside the app shows **Open the system settings**.
4. On Xiaomi, Oppo, Vivo, Samsung and Huawei, open the system app settings and set
   **Battery: unrestricted** and allow **Auto-start** where it exists. Android
   otherwise holds exact alarms until the app is next opened, and a reminder that
   arrives when you open the app is not a reminder.

## The page on the home screen

The widget is the part that keeps working when the app is never opened. Add it
once:

1. Settings, **Put the week on the home screen**, then **Add**. Android asks the
   launcher for a free 4x2 slot.
2. If the launcher does not offer the pin prompt, long-press the home screen,
   choose **Widgets**, then **Ledger**, and drag the card onto the page.

It reads the same database as the app, so the number on the home screen and the
number in the log cannot disagree. It names the hour of the next appointment,
shows how many pages the week has against the contract, and its main label opens
the session that is actually on offer. After the appointment time it stops
saying *Tonight* and admits the hour has passed; past the 90 minute fallback the
ten minute session becomes the primary label. It refreshes itself once a day on
its own and immediately whenever a page is written.

If a release build crashes on launch with a WorkManager stack trace, the R8 keep
rules in `plugins/with-widget-rules.js` were not applied: run
`npx expo prebuild --platform android --no-install` before building. This is the
upstream issue documented in `docs/WIDGET.md`, not a fault of the phone.

## The permission list is the promise

The manifest deliberately blocks `INTERNET`, `ACCESS_NETWORK_STATE`, Firebase
messaging and draw-over-other-apps. The app cannot phone home because Android
will not let it open a socket. There is one APK, not two: the build with network
permissions was discarded rather than kept as a fallback.

## Proving the reminders, one evening

Do this once, before trusting the app with four weeks:

| Step | What to do | What should happen |
|---|---|---|
| 1 | Finish a session, then open Settings | A non-zero count under the save button |
| 2 | Swipe the app away from recents | Nothing yet |
| 3 | Wait for the anchor time | The banner arrives with the app closed |
| 4 | Tap the banner | The app opens on today's page, with today's session letter |
| 5 | Do not train. Wait 90 minutes | The fallback arrives, worded differently |
| 6 | Reboot the phone, do not open the app | Tomorrow's anchor still arrives |
| 7 | Aeroplane mode on, reboot, wait | Still arrives: the alarm is local |
| 8 | Train, then check Settings | Today's reminders are gone, the next days are queued |
| 9 | Let an appointment pass with nothing written | At 08:00 the next morning, "Yesterday went unwritten" arrives, with the price you wrote |
| 10 | Do a ten minute session before 08:00 | That alarm never arrives; the rest of the queue is untouched |

If step 3 fails, it is almost always battery optimisation, not the app. The
queue can be inspected at any time in Settings.

## If Sign it does nothing

The contract page refuses to sign until waist and weight hold real numbers. The
refusal is one line above the button: *"Waist and weight are the two numbers. Put
them in first."* A build before 1.0.0 showed `96.0` and `90.0` in grey as
placeholders, which read as filled values and made the button look dead. Current
builds leave those lines blank, so an empty field looks empty.

## What is verified, and what is not

Verified on this machine:

- 134 domain tests and `tsc --noEmit`.
- The full UI on the iOS simulator.
- This exact APK installed and launched on an Android 14 arm64 emulator: cover,
  contract, permission prompt, home, session, review, log, settings.
- Ten exact alarms queued on the final check for a Mon/Wed/Fri contract (`window=0`): anchor at
  19:00 and fallback at 20:30 on each training day, a morning-after alarm at
  08:00 for each unclosed appointment (including yesterday's, when the app is
  opened after midnight and before 08:00), and the weekly review on Sunday at
  18:00.
- The anchor delivered with the app process killed.
- After `adb reboot`, the queue was restored by the boot receiver without the app
  being opened, and the 19:00 reminder still arrived.
- Tapping the review reminder opened `/review`; tapping the Monday anchor opened
  the home page for that Monday with session A.
- A movement row on the home page is underlined and opens its form page; the back
  tab returns to the same scroll position.
- The eleven loops animate on the form page on Android as well as iOS, confirmed
  by diffing two screenshots a second apart (20,805 pixels changed).
- Tapping *Not this week* on the review page changes the week's single piece of
  advice from "collect more data" to "the floor slipped".
- The home page shows **ONE PAGE SHORT** when this week has fewer pages than the
  contract promises, and a session on a day the contract did not name absorbs a
  blank appointment, so a recovered week stops asking for a make-up.
- The skip page shows the price written at signing at the moment of the decision,
  and with no tokens left it shows the new total: *"The price is due: … This
  makes 7 pages unpaid."*
- The session summary shows **THE PART THAT IS NOT TRAINING**, the reward chosen
  at signing, immediately after the page is written.
- The log counts PAGES, UNPAID and EVENTS, and states the identity line: *"Every
  page is a vote. You have cast 2."*
- Opening the app at 02:00, before the 08:00 alarm, still arms the alarm for the
  previous day. Before the fix the planner only looked forward and that alarm was
  lost for good.
- A floor session logged on the morning of the alarm cancelled the 08:00 alarm in
  `dumpsys alarm` and cleared the page it was chasing, in the same tap. Before the
  fix the repair on the same day was not counted, so the log showed one page more
  unpaid than the alarm promised.
- A contract signed today does not arm an alarm for yesterday, and appointments
  before the signing date are never counted as missed.
- Moving the emulator clock to Thursday 5 November, 07:59, delivered the 08:00
  alarm with **Yesterday went unwritten. Ten minutes still counts. 4 pages unpaid.
  Ten to the jar for every unexplained skip.** Opening the log at 08:01 read
  UNPAID 4: the alarm and the ledger agreed to the page.
- Moving the clock to Saturday 7 November, 07:59, delivered the next alarm as
  **Never miss twice. Two appointments in a row. 5 pages unpaid.** because
  Wednesday and Friday really were both blank.
- Before the fix the Thursday alarm said *Never miss twice* even though Tuesday's
  floor session had repaired Monday. The title is now computed from the same
  repair-aware ledger as UNPAID, so a repaired appointment cannot be called a
  second miss.
- The weekly review is reachable on Saturday, not only Sunday: the home page
  shows *Close the week · Three numbers in, one change out* two days before the
  week ends, so the "two days left" advice can actually be read in time.
- A skip that left the week one page short with no appointment left offered the
  ten minute repair on the skip page itself (`SAT 07 NOV · 19:00`). Declining it
  wrote only the skip.
- After two skips, Saturday morning put the ten minute session first:
  **SHORT THIS WEEK**, *One page short this week. Ten minutes closes it.*, and
  **Ten minutes closes the week** as the primary action, with the full session as
  the quiet alternative.
- Booking the repair from the skip page wrote both lines, the skip and
  `repair.book`, and queued one exact alarm at Sunday 8 November 19:00
  (`window=0`). No second guess, no duplicate.
- At 19:00 the notification read **The page you skipped** / *Ten minutes now
  closes the week. One session, then it is whole.* Tapping it opened floor
  session C directly.
- The floor session's summary read **The week is whole.** / *The page you
  skipped is written. The floor session counts in full.* Home then showed
  **3 of 3 written this week** and the repair was gone.
- A closed day now measures the week inclusively. Before the fix the same home
  screen still said **ONE PAGE SHORT** after the third page had been written:
  the chapter was asking about yesterday while the page was already whole.
- The 20:30 fallback and the 08:00 debt alarm carry `/session?kind=floor`, and
  the session page reads the rotation when it opens. On a device with A already
  written, both landed on floor session B, not session A.
- Tapping the delivered 08:00 debt alarm opened the floor session itself
  (**B · FLOOR**, *Rear-foot-elevated split squat*, set 1 of 2), so the alarm's
  ten minutes costs one tap. Backing out wrote nothing: the ledger still held
  five events.
- The reward written at signing is on the home page before the first set, on the
  line the movement count used to take, so it is above the fold and the *Start
  session* button stays fully visible. Before the change it was only shown after
  the work was finished.
- The skip page names the reward the skip leaves locked, above the price: *"The
  session would have unlocked 'One chapter of the book, only while training.' A
  skip does not."*
- A set logged, the rest clock started, *See the position* opened the form page,
  and the back key returned to the same set with the set count and reps intact.
- The launcher icon and splash are the paper/Georgia mark, not the Expo template.
- The last set writes the page. With the app killed immediately after, the
  `session.finish` row was already in SQLite, and the widget already said
  **Written.** while the summary's *Close the page* button had never been
  pressed. Before the fix the page existed only in memory until that button, so
  a phone that died between the last rep and the summary lost the session.
- *Finish early* with zero sets refuses to write: *"A page needs at least one
  set."* A full session with no work would have shown **Written.** on the home
  screen for nothing.
- The widget was added from Settings through the launcher's pin prompt
  (4 x 2, *This week's pages and the next appointment*), and its
  **START SESSION** and **TEN MINUTES** labels opened the full and floor
  sessions respectively, through the same deep links as the alarms.
- The widget follows the ledger: after a floor session the home screen read
  **2 / 3 PAGES**, **Written.**, *Next page FRI 19:00*; after the third page it
  turned moss and read **The week is whole.**
- The widget is honest about the hour: with the clock at Friday 20:10 it read
  **The page is still blank.** / *The 19:00 appointment has passed.*, and at
  20:45 the ten minute session became the primary label.
- A skip reads **Skipped.** in rust with the next page named, never *Written.*
- The headless path works with the app force-stopped: an `APPWIDGET_UPDATE`
  broadcast started the process, WorkManager ran the widget worker, the SQLite
  read happened, and the launcher redrew the card. No WorkManager or R8 crash
  in the crash buffer.
- The home table fits on a 411 dp wide Android screen: the movement name column
  now shrinks and wraps, so the load column (`2×15`, the heaviest dumbbell pair)
  ends inside the page margin instead of running off the right edge.
- All 11 demonstration loops are inside the APK (confirmed by unzipping it) and
  animate on the form page. The app holds no network permission, so there is no
  route by which they could have arrived except the bundle. Their background is
  the page colour, so the plate has no visible rectangle around it.

Not verified: a physical phone from Xiaomi, Oppo, Vivo, Samsung or Huawei and its
battery manager; the launcher's own 24 hour refresh (the update period is set but
the emulator was not left running overnight); aeroplane mode on real hardware;
and the four weeks. If a launch
fails, the log is the thing to send:

```
adb logcat -d | grep -i -E "ledger|ReactNative|AndroidRuntime" | tail -80
```

## Rebuilding

```
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

Before this goes to anyone else: generate a real keystore, put it in
`android/app/build.gradle`, and change `versionCode` for every build. The current
release signature is the debug key.

## The four-week test

The app is not finished until it has survived four weeks of a real week. The
weekly review is the instrument: waist on Sunday, weight daily, one change out.
If the contract days are wrong, that is a finding about the schedule, not about
you, and the fix is to move the days in Settings rather than to try harder.
