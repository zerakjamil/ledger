import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { barbellLoads } from '../domain/equipment';
import { useStore } from '../state/provider';
import { color, mono, space } from '../theme/tokens';
import { clockLabel, kg } from '../ui/format';
import {
  Field,
  LinkRow,
  Masthead,
  Notice,
  PrimaryButton,
  SecondaryButton,
  Rule,
  Screen,
  SectionHead,
  T,
} from '../ui/kit';
import { notificationStatus, pendingCount } from '../services/notifications';

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const DAY_INDEX = [1, 2, 3, 4, 5, 6, 0];

export default function Settings() {
  const router = useRouter();
  const { state, actions } = useStore();
  const contract = state.contract;

  const [barKg, setBarKg] = useState(String(state.equipment.barKg));
  const [plates, setPlates] = useState(state.equipment.platePairsKg.join(', '));
  const [dumbbells, setDumbbells] = useState(state.equipment.dumbbellsKg.join(', '));
  const [ceiling, setCeiling] = useState(String(state.equipment.maxLoadKg ?? ''));
  const [days, setDays] = useState<number[]>(contract?.days ?? [1, 3, 5]);
  const [hour, setHour] = useState(contract?.hour ?? 19);
  const [minute, setMinute] = useState(contract?.minute ?? 0);
  const [pending, setPending] = useState<number | null>(null);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined' | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pendingCount()
      .then(setPending)
      .catch(() => setPending(null));
    notificationStatus()
      .then(setPermission)
      .catch(() => setPermission(null));
  }, [state.eventCount]);

  const [saved, setSaved] = useState<string | null>(null);

  /** One button. The kit and the hour are saved together, and the queue follows. */
  const save = async () => {
    setBusy(true);
    setSaved(null);
    try {
      await actions.saveEquipment({
        barKg: Number(barKg) || 10,
        platePairsKg: parseList(plates),
        dumbbellsKg: parseList(dumbbells),
        maxLoadKg: Number(ceiling) || undefined,
      });
      const count = contract ? await actions.updateSchedule(days, hour, minute) : 0;
      setPending(count);
      setSaved(
        count === 0
          ? 'Saved. Nothing is queued until notifications are allowed.'
          : `Saved. ${count} ${count === 1 ? 'reminder is' : 'reminders are'} queued on this phone.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const toggleDay = (day: number) => {
    setDays((current) => {
      if (current.includes(day)) {
        /** At least one appointment has to survive, or there is no contract. */
        return current.length === 1 ? current : current.filter((d) => d !== day);
      }
      return current.length >= 5 ? current : [...current, day].sort((a, b) => a - b);
    });
  };

  return (
    <Screen>
      <Masthead title="Settings" back={() => router.back()} />
      <Rule strong />

      <View style={{ gap: space.xs }}>
        <T variant="title">The room and the hour.</T>
        <T variant="small">
          Change the kit and every future prescription uses the new plates. Change the hour and the
          reminder moves with it. Past sessions keep the weights they were done with.
        </T>
      </View>

      <View style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Field label="BAR" value={barKg} onChangeText={setBarKg} keyboardType="decimal-pad" suffix="kg" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="MAX LOAD" value={ceiling} onChangeText={setCeiling} keyboardType="decimal-pad" suffix="kg" />
          </View>
        </View>
        <Field
          label="PLATE PAIRS, PER SIDE"
          value={plates}
          onChangeText={setPlates}
          keyboardType="numbers-and-punctuation"
          suffix="kg"
        />
        <Field
          label="DUMBBELLS, PER HAND"
          value={dumbbells}
          onChangeText={setDumbbells}
          keyboardType="numbers-and-punctuation"
          suffix="kg"
        />
        <View style={{ gap: space.xs }}>
          <T variant="chapter">BUILDABLE BAR WEIGHTS</T>
          <T variant="figureSmall">
            {barbellLoads(state.equipment).map((l) => kg(l)).join(', ')} kg
          </T>
        </View>
      </View>

      <Rule strong />

      <View style={{ gap: space.md }}>
        <SectionHead label="THE APPOINTMENT" right={clockLabel(hour, minute)} />
        <View style={{ flexDirection: 'row', gap: space.xs }}>
          {DAYS.map((label, index) => {
            const day = DAY_INDEX[index]!;
            const on = days.includes(day);
            return (
              <Pressable
                key={index}
                accessibilityRole="button"
                accessibilityLabel={`Day ${index + 1}`}
                accessibilityState={{ selected: on }}
                onPress={() => toggleDay(day)}
                style={{
                  flex: 1,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: on ? color.ink : color.rule,
                  backgroundColor: on ? color.ink : 'transparent',
                }}
              >
                <T variant="figureSmall" style={{ color: on ? color.paper : color.ink }}>
                  {label}
                </T>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <T variant="chapter" style={{ flex: 1 }}>
            ANCHOR
          </T>
          <Stepper value={hour} min={4} max={22} onChange={setHour} />
          <T variant="figure">:</T>
          <Stepper value={minute} min={0} max={45} step={15} onChange={setMinute} />
        </View>

        <PrimaryButton label={busy ? 'Saving' : 'Save both'} disabled={busy} onPress={save} />

        {saved ? <Notice>{saved}</Notice> : null}

        {permission === 'denied' ? (
          <View style={{ gap: space.xs }}>
            <Notice tone="rust">
              Notifications are switched off for Ledger. The queue is empty until they are allowed
              again, and the app cannot open that door for you.
            </Notice>
            <LinkRow
              label="Open the system settings"
              detail="Allow notifications for Ledger"
              onPress={() => void Linking.openSettings()}
            />
          </View>
        ) : (
          <T variant="micro">
            {pending === null
              ? 'Notification queue unavailable on this build.'
              : `${pending} reminders waiting in the system queue.`}
            {Platform.OS === 'android'
              ? ' Android may delay exact alarms until the app is exempted from battery optimisation.'
              : ' iOS keeps at most 64 pending, so the queue is rebuilt in a rolling window.'}
          </T>
        )}
      </View>

      <Rule strong />

      <View>
        <SectionHead label="THE FILE" />
        <LinkRow
          label="Ledger and export"
          detail={`${state.records.length} ${state.records.length === 1 ? 'session' : 'sessions'}, ${state.eventCount} events, plain JSON`}
          onPress={() => router.push('/log')}
        />
        <LinkRow
          label="Weekly review"
          detail="Three numbers in, one change out"
          onPress={() => router.push('/review')}
        />
      </View>

      <View style={{ flex: 1 }} />

      <Rule />
      <Notice>
        No account, no server, no analytics. Every event lives in a SQLite file on this phone and
        nothing opens a socket.
      </Notice>
      <T variant="micro">
        Ledger 1.0.0 · {state.eventCount} events on file · {state.records.length}{' '}
        {state.records.length === 1 ? 'session' : 'sessions'} written
      </T>
      <T variant="micro">
        Demonstration loops © Gym visual, duotoned for this page and bundled for personal use.
      </T>
    </Screen>
  );
}

function Stepper({
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrease"
        onPress={() => onChange(Math.max(min, value - step))}
        hitSlop={8}
        style={{ width: 34, height: 40, alignItems: 'center', justifyContent: 'center' }}
      >
        <T variant="heading">−</T>
      </Pressable>
      <T style={{ fontFamily: mono, fontSize: 18, minWidth: 28, textAlign: 'center', color: color.ink }}>
        {String(value).padStart(2, '0')}
      </T>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase"
        onPress={() => onChange(Math.min(max, value + step))}
        hitSlop={8}
        style={{ width: 34, height: 40, alignItems: 'center', justifyContent: 'center' }}
      >
        <T variant="heading">+</T>
      </Pressable>
    </View>
  );
}

function parseList(raw: string): number[] {
  return raw
    .split(/[, ]+/)
    .map((part) => Number(part))
    .filter((n) => Number.isFinite(n) && n > 0);
}
