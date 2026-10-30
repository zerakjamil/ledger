# Ledger

A focused strength training log and habit accountability app built with Expo and React Native.

Designed around a paper-and-ink aesthetic, local-first event sourcing, and habit psychology that protects consistency without noise or fake rewards.

---

## Highlights

- **Event Sourced**: Every workout, measurement, and skip is stored as an immutable event in local SQLite. State replays cleanly and deterministically.
- **Appointment & Habit Psychology**: Signed contract, scheduled appointments, escalating alarm ladders, and scarce skip tokens.
- **Home Screen Widget**: Native Android home screen widget powered by `react-native-android-widget` displaying weekly progress and upcoming sessions.
- **Camera & Vision Gate**: Optional on-device native vision gate (`GateVision` module) to verify sessions at the bench before starting.
- **Refined Motion Splash**: Seamless branded launch screen with ambient breathing motion ("powered by Ayewar").
- **Zero Cloud Leaks**: Pure offline-first architecture with blocked network permissions for complete privacy.

---

## Tech Stack

- **Framework**: [Expo](https://expo.dev) (SDK 58) with [Expo Router](https://docs.expo.dev/router/introduction/)
- **Runtime**: [React Native](https://reactnative.dev) 0.88 & React 19
- **Database**: Local SQLite via `expo-sqlite`
- **Native Modules**: Kotlin Android modules (`gate-vision`, Android AppWidget provider)
- **Language**: TypeScript with 100% type safety and 200+ unit tests (`bun test`)

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (recommended) or Node.js (>= 20)
- Android SDK / Xcode for native runs

### Setup

```bash
# Clone the repository
git clone https://github.com/zerakjamil/ledger.git
cd ledger

# Install dependencies
bun install

# Run the test suite
bun test

# Typecheck
bun run typecheck

# Start Expo dev server
npx expo start
```

### Android Native Build

```bash
npx expo run:android
```

---

## Documentation

Detailed architecture and design manuals are maintained in the [`docs/`](./docs) directory:

- [**PROGRAM.md**](./docs/PROGRAM.md): Exercise selection, loading progressions, and session templates
- [**PSYCHOLOGY.md**](./docs/PSYCHOLOGY.md): Habit loops, appointments, skip tokens, and accountability mechanics
- [**INSTALL.md**](./docs/INSTALL.md): APK installation guide and device setup
- [**WIDGET.md**](./docs/WIDGET.md): Android Widget specification and sync lifecycle
- [**BASELINE.md**](./docs/BASELINE.md): The core system contract and starting points
- [**ASSETS.md**](./docs/ASSETS.md): Asset generation and design tokens

---

## License

[MIT](./LICENSE)
