# The widget, and why it is built this way

The ledger is meant to be installed and forgotten, so the week has to survive
outside the app. The Android home screen widget is that surface: the next
appointment, the pages written, and one tap to the session that is actually on
offer.

## Choosing a library, not writing Kotlin

The feature needed a real Android `AppWidgetProvider`, a headless render path,
and an Expo config plugin. Writing it by hand would have meant maintaining
Kotlin, RemoteViews, WorkManager and prebuild modifications inside a TypeScript
project. The options on GitHub, checked in October 2026:

| Project | Stars | State | Fit |
|---|---:|---|---|
| [`sAleksovski/react-native-android-widget`](https://github.com/sAleksovski/react-native-android-widget) | 899 | MIT, active (0.24.0, 22 Oct 2026) | React primitives, Expo config plugin, headless task handler, click actions and deep links, `requestPinWidget`. Chosen. |
| [`mike-stewart-dev/expo-widgets`](https://github.com/mike-stewart-dev/expo-widgets) | 307 | Last push Jul 2025 | Focused on iOS WidgetKit. The Android path is not the mature one. |
| [`gaishimo/eas-widget-example`](https://github.com/gaishimo/eas-widget-example) | 401 | Last push May 2024 | An example of the EAS/WidgetKit route, iOS only. |
| [`ImBIOS/RNWidget`](https://github.com/ImBIOS/RNWidget) | 32 | Last push Sep 2023 | Stale, and a tutorial rather than a maintained dependency. |
| Hand-written Kotlin | n/a | n/a | Full control, but a second language and a second build system to maintain for one page of text. |

The chosen library renders the React tree to a bitmap through `RemoteViews`, so
the widget can reuse the app's layout thinking but not its `Text` component.
Widgets must not use hooks, and the file needs `'use no memo'` because React
Compiler would otherwise add them. Fonts are limited to what the launcher can
resolve: `serif`, `sans-serif`, `monospace`. Those are the same three voices the
app already uses, so nothing had to be bundled or licensed.

## What is shared with the app

`src/domain/widget.ts` is pure. It takes an `AppState` and a `Date`, and returns
one sentence plus at most two actions. The app and the headless task both call
it, so they cannot disagree about the week.

| Situation | Home screen |
|---|---|
| No contract | The appointment, and a link to onboarding |
| Appointed day, before the hour | `Tonight, 19:00` / `Session C · 4 movements` |
| Appointed day, after the hour | `The page is still blank.` / `The 19:00 appointment has passed.` |
| Past the 90 minute fallback | `Ten minutes.` / the floor session leads |
| First session ever | `The first page.` |
| Day written | `Written.` and the next appointment |
| Day skipped | `Skipped.` or `Token spent.`, and the next appointment |
| Week whole | `The week is whole.` in moss |
| One page short, last chance | `One page short.` and `TEN MINUTES` |
| Appointment still ahead | `1 page short.` and `START THE SESSION` |
| Repair booked | `Repair booked.` and the day |
| Repair day | `Ten minutes.` and `START THE REPAIR` |
| Day written, week lost | `The week closed short.` with no action |
| Rest day | `Nothing to lift.` and the next page |
| Recovery | `Nothing to lift.` and the time the page opens |

The count is recomputed from the entries for the current week, not from the
consistency snapshot. A launcher can render the widget at 00:01, and a snapshot
taken the previous day would still be counting last week.

The one rule added while testing the widget: a day that is already closed
cannot be offered another ten minutes, because the ledger keeps one page per
day and the skip page has already made the repair offer before it wrote the
skip. `lastChance` therefore refuses any closed day, and the widget calls a skip
a skip. Both are pinned by `src/domain/widget.test.ts`.

## Updates, and what can go wrong

- The app calls `requestWidgetUpdate` after every commit, after a refresh, and
  when it returns to the foreground. No widget means no-op.
- The manifest sets `updatePeriodMillis` to one day, not the 30 minute minimum.
  The widget is a page, not a live dashboard, and background image rendering is
  the expensive path.
- The headless task reads SQLite directly. If the read fails, it renders
  `Open the ledger.` rather than showing a number it cannot defend.
- Deep links are `ledger:///`, `ledger:///session?kind=floor`,
  `ledger:///session?kind=full` and `ledger:///onboarding`, and they were tested
  cold and warm on the emulator before the widget was written.

The headless path was proved the way the launcher will use it: the app was
force-stopped, the database was changed on disk, and
`am broadcast -a android.appwidget.action.APPWIDGET_UPDATE` started a cold
process. WorkManager ran `RNWidgetBackgroundTaskWorker`, the task read SQLite,
and the card redrew. No crash in the crash buffer, which is the regression the
keep rules exist for.

Two upstream issues matter:

- [Issue #159](https://github.com/sAleksovski/react-native-android-widget/issues/159):
  release builds on Expo SDK 58 / AGP 9 crash in WorkManager's startup
  initializer because R8 strict full mode strips the Room database constructor.
  `plugins/with-widget-rules.js` appends the two keep rules to
  `android/app/proguard-rules.pro` at prebuild time. The rules also protect
  `InputMerger`, the other reflective class in the same path.
- [Issue #165](https://github.com/sAleksovski/react-native-android-widget/issues/165):
  headless widget work can ANR on slow phones when it starts a cold process.
  The daily update period keeps that path rare. The app writes the widget while
  its process is already alive, which is the cheap case.

`android/` is generated and ignored. The keep rules are a local config plugin so
a clean clone and a fresh prebuild still produce a release that launches.

## Installing the widget

Settings has a row, **Put the week on the home screen**, which calls
`requestPinWidget`. Launchers without the pin prompt get the manual instruction:
long-press the home screen, choose Widgets, then Ledger. The widget is not added
automatically, because the launcher owns the home screen and an app that places
things there without asking is a guest that rearranges the furniture.
