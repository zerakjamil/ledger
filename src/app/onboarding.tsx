import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { HOME_KIT } from '../domain/equipment';
import { useStore } from '../state/provider';
import { color, mono, sans, space } from '../theme/tokens';
import {
  Field,
  Masthead,
  Notice,
  PrimaryButton,
  Rule,
  Screen,
  SectionHead,
  T,
} from '../ui/kit';

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const DAY_INDEX = [1, 2, 3, 4, 5, 6, 0];

export default function Onboarding() {
  const router = useRouter();
  const { actions } = useStore();

  const [waist, setWaist] = useState('');
  const [weight, setWeight] = useState('');
  const [barKg, setBarKg] = useState(String(HOME_KIT.barKg));
  const [plates, setPlates] = useState(HOME_KIT.platePairsKg.join(', '));
  const [dumbbells, setDumbbells] = useState(HOME_KIT.dumbbellsKg.join(', '));
  const [maxLoad, setMaxLoad] = useState(String(HOME_KIT.maxLoadKg ?? 30));
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [hour, setHour] = useState(19);
  const [minute, setMinute] = useState(0);
  const [sentence, setSentence] = useState(
    'When it is 7pm and I am home, I put on shoes and start set 1.',
  );
  const [reward, setReward] = useState('One chapter of the book, only while training.');
  const [stake, setStake] = useState('Ten to the jar for every unexplained skip.');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const valid = useMemo(() => {
    const w = Number(waist);
    const kg = Number(weight);
    return Number.isFinite(w) && w > 50 && w < 200 && Number.isFinite(kg) && kg > 30 && kg < 300;
  }, [waist, weight]);

  const toggleDay = (day: number) => {
    setDays((current) =>
      current.includes(day)
        ? current.filter((d) => d !== day)
        : current.length >= 5
          ? current
          : [...current, day].sort((a, b) => a - b),
    );
  };

  const sign = async () => {
    setProblem(null);
    if (!valid) {
      setProblem('Waist and weight are the two numbers. Put them in first.');
      return;
    }
    if (days.length < 2) {
      setProblem('Pick at least two days. One is a mood, not a plan.');
      return;
    }
    const platePairs = parseList(plates);
    if (platePairs.length === 0) {
      setProblem('List at least one plate pair, for example 5, 2.5, 1.25.');
      return;
    }
    setBusy(true);
    try {
      await actions.saveEquipment({
        barKg: Number(barKg) || 10,
        platePairsKg: platePairs,
        dumbbellsKg: parseList(dumbbells),
        maxLoadKg: Number(maxLoad) || undefined,
      });
      await actions.logWaist(Number(waist));
      await actions.logWeight(Number(weight));
      await actions.signContract({
        days,
        hour,
        minute,
        ifText: sentence.trim(),
        reward: reward.trim(),
        stake: stake.trim(),
      });
      router.replace('/');
    } catch (cause) {
      setProblem(cause instanceof Error ? cause.message : 'The contract could not be saved.');
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Masthead title="The contract" right="NO. 001" />
      <Rule strong />

      <View style={{ gap: space.sm, paddingTop: space.sm }}>
        <T variant="display">The contract, in five parts.</T>
        <T variant="small">
          The only setup screen in the app. Four minutes now, and you never configure anything again.
        </T>
      </View>

      <Rule strong />

      <Block index="01" title="The number that matters">
        <Field
          label="WAIST AT THE NAVEL"
          value={waist}
          onChangeText={setWaist}
          keyboardType="decimal-pad"
          suffix="cm"
          hint="Three readings, same spot, breathe out. Put the middle one in."
        />
        <Field
          label="BODYWEIGHT"
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
          suffix="kg"
          hint="Morning, after the bathroom, before food. You will log it daily from now on."
        />
      </Block>

      <Rule />

      <Block index="02" title="What is actually in the room">
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Field label="BAR" value={barKg} onChangeText={setBarKg} keyboardType="decimal-pad" suffix="kg" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="MAX LOAD" value={maxLoad} onChangeText={setMaxLoad} keyboardType="decimal-pad" suffix="kg" />
          </View>
        </View>
        <Field
          label="PLATE PAIRS, PER SIDE"
          value={plates}
          onChangeText={setPlates}
          keyboardType="numbers-and-punctuation"
          suffix="kg"
          hint="Weigh one plate if you are unsure. The app will never prescribe a weight you cannot build."
        />
        <Field
          label="DUMBBELLS, PER HAND"
          value={dumbbells}
          onChangeText={setDumbbells}
          keyboardType="numbers-and-punctuation"
          suffix="kg"
        />
        <Notice>
          With 30 kg of plates, the bar is a pressing and conditioning tool. The dumbbells carry the
          leg work. The plan already assumes this.
        </Notice>
      </Block>

      <Rule />

      <Block index="03" title="When">
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
                  height: 48,
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
        <T variant="small">
          Two of these will be missed in the first month. The rotation absorbs it. Missing twice in a
          row is the only thing that breaks the run.
        </T>
      </Block>

      <Rule />

      <Block index="04" title="The sentence you read at the door">
        <TextInput
          value={sentence}
          onChangeText={setSentence}
          multiline
          style={{
            fontFamily: sans,
            fontSize: 18,
            lineHeight: 27,
            color: color.ink,
            borderLeftWidth: 2,
            borderLeftColor: color.rust,
            paddingLeft: space.md,
            paddingVertical: space.sm,
            minHeight: 84,
          }}
          placeholder="When it is 7pm and I am home, I put on shoes and start set 1."
          placeholderTextColor={color.inkFaint}
          selectionColor={color.rust}
        />
        <T variant="small">
          Name a time and a place, not a feeling. This is the part that works when motivation has
          already left the room.
        </T>
      </Block>

      <Rule />

      <Block index="05" title="The trade">
        <Field
          label="REWARD, ONLY WHILE TRAINING"
          value={reward}
          onChangeText={setReward}
          multiline
          hint="Something you want, unlocked only by the session."
        />
        <Field
          label="STAKE FOR AN UNEXPLAINED SKIP"
          value={stake}
          onChangeText={setStake}
          multiline
          hint="Small, real, and paid the same day. Not a threat, a price."
        />
      </Block>

      {problem ? <Notice tone="rust">{problem}</Notice> : null}

      <PrimaryButton label={busy ? 'Signing' : 'Sign it'} note="two skip tokens a month" disabled={busy} onPress={sign} />
      <T variant="micro">
        Using a token keeps the run. Running out is information, not failure. Days shown never reset.
      </T>
    </Screen>
  );
}

function Block({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'baseline' }}>
        <T variant="figureSmall" style={{ color: color.rust }}>
          {index}
        </T>
        <T variant="heading" style={{ flex: 1 }}>
          {title}
        </T>
      </View>
      {children}
    </View>
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
