import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { todayKey } from '../domain/consistency';
import { closedBy, dayPlan } from '../domain/day';
import { describeLoad } from '../domain/equipment';
import { advance } from '../domain/progression';
import { FLOOR_SESSION, MOVEMENTS, ROTATION, SESSIONS } from '../domain/program';
import { nextSession } from '../domain/rotation';
import type { SessionKey, SetResult } from '../domain/types';
import { cancelTodaysHelp } from '../services/notifications';
import { useStore } from '../state/provider';
import { color, mono, rule, sans, space } from '../theme/tokens';
import { clockLabel, dayStamp, elapsedLabel, kg, restLabel } from '../ui/format';
import {
  Masthead,
  PrimaryButton,
  QuietButton,
  Rule,
  Screen,
  Stamp,
  T,
} from '../ui/kit';

const RIR = [
  { value: 0, word: 'none' },
  { value: 1, word: 'one' },
  { value: 2, word: 'two' },
  { value: 3, word: 'three' },
  { value: 4, word: 'four' },
  { value: 5, word: 'easy' },
];

const REST_SECONDS = 90;

export default function Session() {
  useKeepAwake();
  const router = useRouter();
  const params = useLocalSearchParams<{ key?: string; kind?: string }>();
  const { state, ready, actions } = useStore();

  /**
   * A notification can open this page without a key. Inferring it from the
   * rotation means the 20:30 fallback lands on the page that is actually next,
   * not on session A forever. Read once, when the ledger has loaded: finishing
   * a session must not flip the key on the summary.
   */
  const inferredKey = useMemo(
    () =>
      nextSession(
        state.records.length > 0 ? state.records[state.records.length - 1]! : null,
        new Date(),
      ).key,
    [ready],
  );
  const key = (
    params.key === 'A' || params.key === 'B' || params.key === 'C' ? params.key : inferredKey
  ) as SessionKey;
  const kind = params.kind === 'floor' ? 'floor' : 'full';
  const session = SESSIONS[key];
  const movementIds = kind === 'floor' ? FLOOR_SESSION : session.movementIds;

  /**
   * A 640 dp Android phone cannot hold the table, the stepper and the RIR row
   * at once. Short screens get the compact runner: one line of context and a
   * row of ticks instead of the full set table.
   */
  const { height: screenHeight } = useWindowDimensions();
  const compact = screenHeight < 760;

  const startedAt = useRef(new Date()).current;
  /** The booked repair is written by this session, and the summary should say so. */
  const repairedToday = state.repair !== null && state.repair.day === todayKey(startedAt);
  /**
   * The alarm keeps ringing after the page is written, and tapping it used to
   * open a fresh session. Writing that session would burn two rotation slots on
   * one day and move every prescription twice. A page is a day, so the second
   * visit gets the receipt instead of the form.
   */
  const alreadyWritten = closedBy(state, todayKey(startedAt)) === 'session';
  const [moveIndex, setMoveIndex] = useState(0);
  const [setIndex, setSetIndex] = useState(0);
  const [results, setResults] = useState<Record<string, SetResult[]>>({});
  const [rest, setRest] = useState<number | null>(null);
  const [phase, setPhase] = useState<'work' | 'summary'>('work');
  const [saving, setSaving] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const movementId = movementIds[moveIndex] ?? movementIds[0]!;
  const movement = MOVEMENTS[movementId]!;
  const prescription = state.prescriptions[movementId]!.prescription;
  const setCount = kind === 'floor' ? Math.min(2, prescription.sets) : prescription.sets;
  const [reps, setReps] = useState(prescription.target);
  const [rir, setRir] = useState(2);
  const unit = movement.unit === 'seconds' ? 's' : '';

  useEffect(() => {
    setReps(prescription.target);
    setRir(2);
  }, [prescription.target, movementId]);

  useEffect(() => {
    if (rest === null) return;
    if (rest <= 0) {
      setRest(null);
      return;
    }
    const timer = setTimeout(() => setRest((value) => (value === null ? null : value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [rest]);

  const logged = results[movementId] ?? [];
  const lastTime = state.lastResults[movementId] ?? [];
  const totalSets = movementIds.reduce((sum, id) => sum + (results[id]?.length ?? 0), 0);

  /**
   * The page is written when the last set is logged, not when a second button is
   * pressed. A summary that already says "written" while the database is still
   * empty is the one lie the ledger cannot afford, and a phone that dies between
   * the last rep and the button would lose the whole session.
   */
  const writing = useRef(false);
  const writePage = async (
    all: Record<string, SetResult[]>,
    final: 'full' | 'floor',
    retry = false,
  ) => {
    /** A fast double tap on the last set must not write two pages. */
    if (writing.current) return;
    writing.current = true;
    setSaving(true);
    try {
      await actions.finishSession(key, final, startedAt, all);
      setPhase('summary');
    } catch {
      Alert.alert(
        'The page did not get written.',
        retry
          ? 'The sets are still on this screen. Nothing was lost.'
          : 'The work is still on this screen. Nothing was lost.',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Try again', onPress: () => void writePage(all, final, true) },
        ],
      );
    } finally {
      writing.current = false;
      setSaving(false);
    }
  };

  const logSet = () => {
    /**
     * The first set is the start, not the open. Opening the app is not
     * training, so the help alarms for today keep ringing until one set is on
     * the page; after that they would only ring over a session. The
     * morning-after is not touched, because an abandoned page still owes it.
     */
    if (totalSets === 0) void cancelTodaysHelp(todayKey()).catch(() => undefined);
    const next: SetResult[] = [...logged, { reps, loadKg: prescription.loadKg, rir }];
    const all = { ...results, [movementId]: next };
    setResults(all);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);

    if (setIndex + 1 >= setCount) {
      if (moveIndex + 1 >= movementIds.length) {
        void writePage(all, kind);
      } else {
        setMoveIndex(moveIndex + 1);
        setSetIndex(0);
        setRest(REST_SECONDS);
      }
      return;
    }
    setSetIndex(setIndex + 1);
    setRest(REST_SECONDS);
  };

  const leave = () => {
    if (totalSets === 0) {
      router.replace('/');
      return;
    }
    Alert.alert(
      'Leave the page?',
      `${totalSets} ${totalSets === 1 ? 'set is' : 'sets are'} on the page but nothing is written. The rotation will not move.`,
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => router.replace('/') },
      ],
    );
  };

  const finishEarly = () => {
    /**
     * A page with no sets is not a page. Closing a full session here would put
     * "Written." on the home screen for work that never happened, so an empty
     * page leaves instead of being written.
     */
    if (totalSets === 0) {
      Alert.alert(
        'Nothing is written yet.',
        'A page needs at least one set. Leaving now writes nothing and the rotation stays put.',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: () => router.replace('/') },
        ],
      );
      return;
    }
    Alert.alert(
      'Close as a floor session?',
      `${totalSets} ${totalSets === 1 ? 'set' : 'sets'} will be written. It counts for the week and no load moves.`,
      [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Close it', onPress: () => void writePage(results, 'floor', true) },
      ],
    );
  };

  const decisions = useMemo(
    () =>
      movementIds
        .map((id) => {
          const sets = results[id] ?? [];
          if (sets.length === 0) return null;
          const definition = MOVEMENTS[id]!;
          const previous = state.prescriptions[id]!;
          const out = advance(
            {
              movement: definition,
              prev: previous.prescription,
              results: sets,
              stalls: previous.stalls,
            },
            state.equipment,
          );
          return { id, definition, previous: previous.prescription, out };
        })
        .filter((value): value is NonNullable<typeof value> => value !== null),
    [movementIds, results, state.equipment, state.prescriptions],
  );

  if (!ready) {
    return (
      <Screen>
        <Masthead title="Ledger" />
        <Rule strong />
        <T variant="title">Opening the page</T>
      </Screen>
    );
  }

  if (alreadyWritten) {
    const plan = dayPlan(state, todayKey(startedAt));
    return (
      <Screen>
        <Masthead title="Ledger" />
        <Rule strong />
        <View style={{ gap: space.sm, paddingTop: space.sm }}>
          <T variant="chapter">TODAY</T>
          <T variant="display">Already written.</T>
          <T variant="body">
            One page a day. The work is in the ledger and the rotation has already moved.
          </T>
          <T variant="small" style={{ color: color.inkSoft }}>
            {plan.nextDay
              ? `Next page ${dayStamp(plan.nextDay)} at ${clockLabel(
                  state.contract?.hour ?? 19,
                  state.contract?.minute ?? 0,
                )}.`
              : 'The next page is not set.'}
          </T>
          <PrimaryButton label="Back to the ledger" onPress={() => router.replace('/')} />
        </View>
      </Screen>
    );
  }

  if (phase === 'summary') {
    return (
      <Screen>
        <Masthead title="Ledger" right={elapsedLabel(seconds)} />
        <Rule strong />
        <View style={{ gap: space.xs, paddingTop: space.sm }}>
          <T variant="chapter">{kind === 'floor' ? 'FLOOR SESSION' : `SESSION ${key} CLOSED`}</T>
          <T variant="display">
            {kind === 'floor'
              ? repairedToday
                ? 'The week is whole.'
                : 'Ten minutes. It counts.'
              : 'Written down.'}
          </T>
          <T variant="body" style={{ color: color.inkSoft }}>
            {repairedToday
              ? 'The page you skipped is written. The floor session counts in full.'
              : `${totalSets} ${totalSets === 1 ? 'set' : 'sets'} on the page. The next prescription is already decided.`}
          </T>
        </View>

        {state.contract?.reward.trim() ? (
          /**
           * The trade the user wrote at signing, paid at the only moment it can
           * be paid. A reward that lives in settings is a settings field.
           */
          <View style={styles.reward}>
            <T variant="chapter" style={{ color: color.rust }}>
              THE PART THAT IS NOT TRAINING
            </T>
            <T variant="body">{state.contract.reward.trim()}</T>
          </View>
        ) : null}

        <Rule strong />

        <View>
          {decisions.map((decision, index) => (
            <View key={decision.id}>
              <View style={{ paddingVertical: space.s, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <T variant="figureSmall" style={{ width: 20, color: color.inkFaint }}>
                    {String(index + 1).padStart(2, '0')}
                  </T>
                  <T variant="body" style={{ flex: 1 }} numberOfLines={2}>
                    {decision.definition.name}
                  </T>
                  <Stamp label={stampFor(decision.out.reason)} tone={toneFor(decision.out.reason)} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.md, paddingLeft: 28 }}>
                  <T variant="title" style={styles.delta}>
                    {prescriptionDelta(decision)}
                  </T>
                  <T variant="figureSmall">{loadDelta(decision)}</T>
                </View>
                <T variant="small" style={{ paddingLeft: 28 }}>
                  {explain(decision.out.reason)}
                </T>
              </View>
              <Rule />
            </View>
          ))}
        </View>

        <T variant="small">
          {key} is written. The rotation moves to {nextKey(key)} next, and the page will say so on
          the day.
        </T>

        <View style={{ flex: 1 }} />
        <PrimaryButton
          label="Close the page"
          onPress={() => router.replace('/')}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <Masthead right={elapsedLabel(seconds)} />
      <Rule strong />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <QuietButton label="Leave" onPress={leave} />
        <T variant="chapter">
          {moveIndex + 1} / {movementIds.length}
        </T>
        <QuietButton label="Finish early" onPress={finishEarly} />
      </View>

      <View style={{ gap: space.xs }}>
        <T variant="chapter">
          {key} · {kind === 'floor' ? 'FLOOR' : session.title.toLocaleUpperCase()}
        </T>
        <T variant="title">{movement.name}</T>
        <T variant="figure">
          {prescription.sets} × {prescription.target}
          {unit} · {describeLoad(movement, prescription.loadKg)} · RIR {movement.rirTarget}
        </T>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`How to do ${movement.name}`}
          hitSlop={10}
          onPress={() => router.push({ pathname: '/form/[id]', params: { id: movement.id } })}
          style={{ alignSelf: 'flex-start' }}
        >
          <T variant="micro" style={{ textDecorationLine: 'underline', color: color.inkSoft }}>
            See the position
          </T>
        </Pressable>
        {prescription.stage > 0 ? (
          <T variant="small" style={{ color: color.rust }}>
            Lever {prescription.stage}: {movement.levers[prescription.stage]}
          </T>
        ) : null}
      </View>

      <Rule strong />

      {/*
        * During work the table takes the slack and the controls sit at the
        * bottom, under the thumb. During rest the clock is the only thing that
        * matters, so the table shrinks to its content and the clock takes the
        * middle of the screen instead of floating above a hole.
        */}
      {/*
        * A phone shorter than an iPhone (640 dp is common on Android) cannot
        * hold the title, the table, the stepper and the RIR row at once. The
        * table scrolls inside its own box so its last lines can never spill onto
        * the controls; during rest it steps aside entirely.
        */}
      {compact ? null : (
      <ScrollView
        style={{ flex: rest === null ? 1 : 0 }}
        contentContainerStyle={{ paddingBottom: space.sm }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline', paddingBottom: space.sm }}>
          <T variant="chapter" style={{ width: 34 }}>
            SET
          </T>
          <T variant="chapter" style={{ width: 96 }}>
            LAST
          </T>
          <T variant="chapter" style={{ flex: 1, textAlign: 'right' }}>
            {movement.unit === 'seconds' ? 'HELD' : 'REPS'}
          </T>
          <T variant="chapter" style={{ width: 46, textAlign: 'right' }}>
            RIR
          </T>
          <View style={{ width: 26 }} />
        </View>
        <Rule />

        {Array.from({ length: setCount }).map((_, index) => {
          const done = logged[index];
          const isCurrent = index === setIndex;
          const prior = lastTime[index];
          return (
            <View key={index}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  minHeight: 44,
                  backgroundColor: isCurrent ? color.paperDeep : 'transparent',
                }}
              >
                <T variant="figure" style={{ width: 34, color: color.inkFaint }}>
                  {String(index + 1).padStart(2, '0')}
                </T>
                <T variant="figureSmall" style={{ width: 96 }}>
                  {prior ? `${prior.reps}${unit} @ ${kg(prior.loadKg)}` : '—'}
                </T>
                <T
                  variant="figure"
                  style={{
                    flex: 1,
                    textAlign: 'right',
                    color: done ? color.ink : isCurrent ? color.ink : color.inkFaint,
                    fontWeight: isCurrent ? '700' : '400',
                  }}
                >
                  {done ? done.reps : isCurrent ? reps : prescription.target}
                </T>
                <T variant="figure" style={{ width: 46, textAlign: 'right', color: done ? color.ink : color.inkFaint }}>
                  {done ? done.rir : isCurrent ? rir : movement.rirTarget}
                </T>
                <View style={{ width: 26, alignItems: 'flex-end' }}>
                  {done ? <T variant="body" style={{ color: color.rust }}>✓</T> : null}
                </View>
              </View>
              <Rule />
            </View>
          );
        })}

        {lastTime.length === 0 ? (
          <View style={{ paddingTop: space.md }}>
            <T variant="micro">
              First time on the page. Pick a weight you can leave two reps in the tank with.
            </T>
          </View>
        ) : null}
      </ScrollView>
      )}

      {rest !== null ? (
        <View style={{ flex: 1, justifyContent: 'center', gap: space.sm, paddingBottom: space.xl }}>
          <Rule strong />
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <T variant="chapter">REST</T>
            <T variant="chapter">
              NEXT · SET {setIndex + 1} OF {setCount}
            </T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
            <T style={styles.restClock}>{restLabel(rest)}</T>
            <T variant="micro">of {restLabel(REST_SECONDS)}</T>
          </View>
          <View style={styles.restTrack}>
            <View
              style={[
                styles.restFill,
                { width: `${Math.max(0, Math.min(100, (rest / REST_SECONDS) * 100))}%` },
              ]}
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <QuietButton label="−15s" onPress={() => setRest(Math.max(5, rest - 15))} />
            <QuietButton label="Skip rest" onPress={() => setRest(null)} />
            <QuietButton label="+15s" onPress={() => setRest(rest + 15)} />
          </View>
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          <Rule strong />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T variant="chapter">
              SET {setIndex + 1} OF {setCount}
            </T>
            <T variant="micro">
              {compact
                ? lastTime[setIndex]
                  ? `Last ${lastTime[setIndex]!.reps}${unit} @ ${kg(lastTime[setIndex]!.loadKg)}`
                  : 'First time'
                : movement.unit === 'seconds'
                  ? 'seconds held'
                  : 'reps completed'}
            </T>
          </View>
          {compact ? (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {Array.from({ length: setCount }).map((_, index) => {
                const done = logged[index] !== undefined;
                const current = index === setIndex;
                return (
                  <View
                    key={index}
                    style={{
                      flex: 1,
                      height: 3,
                      backgroundColor: done ? color.ink : current ? color.rust : color.rule,
                    }}
                  />
                );
              })}
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <StepKey label="−" accessibilityLabel="One less rep" onPress={() => setReps(Math.max(1, reps - 1))} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <T style={{ fontFamily: mono, fontSize: 52, lineHeight: 58, color: color.ink }}>{reps}</T>
              <T variant="micro">{movement.unit === 'seconds' ? 'seconds' : 'reps'}</T>
            </View>
            <StepKey label="+" accessibilityLabel="One more rep" onPress={() => setReps(reps + 1)} />
          </View>

          <View style={{ gap: space.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T variant="chapter">REPS IN RESERVE</T>
              <T variant="micro">two is the target</T>
            </View>
            <View style={{ flexDirection: 'row', gap: space.xs }}>
              {RIR.map((option) => {
                const on = rir === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityLabel={`${option.value} reps in reserve, ${option.word}`}
                    accessibilityState={{ selected: on }}
                    onPress={() => setRir(option.value)}
                    style={{
                      flex: 1,
                      minHeight: 52,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: on ? color.ink : color.rule,
                      backgroundColor: on ? color.ink : 'transparent',
                      gap: 1,
                    }}
                  >
                    <Text style={{ fontFamily: mono, fontSize: 16, color: on ? color.paper : color.ink }}>
                      {option.value === 5 ? '4+' : option.value}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ fontFamily: sans, fontSize: 9, letterSpacing: 0.2, color: on ? color.rule : color.inkFaint }}
                    >
                      {option.word}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <PrimaryButton
            label={saving ? 'Writing the page' : 'Log set'}
            note={
              saving
                ? 'The last set is on the page.'
                : `${reps}${unit || ' reps'} · ${describeLoad(movement, prescription.loadKg)} · RIR ${rir}`
            }
            disabled={saving}
            onPress={logSet}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = {
  delta: { fontSize: 20, lineHeight: 26 },
  restClock: {
    fontFamily: mono,
    fontSize: 44,
    lineHeight: 50,
    color: color.ink,
    fontVariant: ['tabular-nums' as const],
  },
  restTrack: { height: 4, backgroundColor: color.paperDeep },
  restFill: { height: 4, backgroundColor: color.rust },
  reward: {
    borderLeftWidth: 2,
    borderLeftColor: color.rust,
    paddingLeft: space.sm,
    paddingVertical: 2,
    gap: 2,
  },
};

function StepKey({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 56,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: rule.thin,
        borderColor: color.ruleStrong,
        backgroundColor: pressed ? color.raised : 'transparent',
      })}
    >
      <T variant="title">{label}</T>
    </Pressable>
  );
}

function prescriptionDelta(decision: {
  previous: { sets: number; target: number };
  out: { next: { sets: number; target: number } };
  definition: { unit: string };
}): string {
  const { previous, out, definition } = decision;
  const unit = definition.unit === 'seconds' ? 's' : '';
  const next = `${out.next.sets} × ${out.next.target}${unit}`;
  if (previous.sets === out.next.sets && previous.target === out.next.target) return next;
  return `${previous.sets} × ${previous.target}${unit}  →  ${next}`;
}

function loadDelta(decision: {
  previous: { loadKg: number };
  out: { next: { loadKg: number } };
  definition: { loading: { kind: string; hands?: number } };
}): string {
  const { previous, out, definition } = decision;
  if (definition.loading.kind === 'bodyweight') return 'bodyweight';
  const each = definition.loading.kind === 'dumbbell' && definition.loading.hands === 2 ? ' each' : '';
  if (previous.loadKg !== out.next.loadKg) {
    return `${kg(previous.loadKg)}  →  ${kg(out.next.loadKg)} kg${each}`;
  }
  return `${kg(out.next.loadKg)} kg${each}`;
}

function nextKey(key: SessionKey): SessionKey {
  return ROTATION[(ROTATION.indexOf(key) + 1) % ROTATION.length]!;
}

function stampFor(reason: string): string {
  switch (reason) {
    case 'add-rep':
      return 'ADD REP';
    case 'add-load':
      return 'ADD LOAD';
    case 'add-set':
      return 'ADD SET';
    case 'escalate':
      return 'NEW LEVER';
    case 'deload':
      return 'DELOAD';
    case 'maxed':
      return 'MAXED';
    case 'hold-partial':
      return 'SAVED';
    default:
      return 'HOLD';
  }
}

function toneFor(reason: string): 'rust' | 'moss' | 'faint' {
  if (reason === 'deload' || reason === 'maxed') return 'faint';
  if (reason === 'hold-missed' || reason === 'hold-effort') return 'rust';
  return 'moss';
}

function explain(reason: string): string {
  switch (reason) {
    case 'add-rep':
      return 'Same weight. One more rep on every set.';
    case 'add-load':
      return 'Heavier next time. Reps start again at the bottom of the window.';
    case 'add-set':
      return 'The plates have nothing left to give, so the volume moves instead.';
    case 'escalate':
      return 'Weight stays. Tempo takes over.';
    case 'hold-missed':
      return 'A missed rep never buys weight. Repeat it.';
    case 'hold-effort':
      return 'That was closer to failure than the plan allows. Hold.';
    case 'deload':
      return 'Two misses in a row is a signal, not a character flaw.';
    case 'maxed':
      return 'Everything this kit can load is loaded. A pull-up bar and another pair of plates unlock the next step.';
    case 'hold-partial':
      return 'The run keeps, the weight does not move.';
    default:
      return 'Saved.';
  }
}
