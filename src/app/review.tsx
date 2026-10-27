import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { weeklyAdvice } from '../domain/coach';
import { startOfWeek, todayKey, weekdayOf } from '../domain/consistency';
import { waistTrend, weightTrend } from '../domain/state';
import { useStore } from '../state/provider';
import { color, space } from '../theme/tokens';
import { oneDecimal, shortDay, signed } from '../ui/format';
import {
  Choice,
  Field,
  LinkRow,
  Masthead,
  PrimaryButton,
  Rule,
  Screen,
  SectionHead,
  T,
} from '../ui/kit';

export default function Review() {
  const router = useRouter();
  const { state, actions } = useStore();
  const today = todayKey();
  const weight = weightTrend(state.weights);
  const waist = waistTrend(state.waists);

  const [weightText, setWeightText] = useState('');
  const [waistText, setWaistText] = useState('');
  /**
   * The question is about the week, not about today. Asking "kept?" and then
   * looking up a single calendar day means it always opens unanswered on the
   * day the review is actually written.
   */
  const weekStart = startOfWeek(today);
  const floorThisWeek = state.stepDays.some((day) => day >= weekStart);
  const [floorDone, setFloorDone] = useState<boolean | null>(floorThisWeek ? true : null);
  const [busy, setBusy] = useState(false);

  const weekday = weekdayOf(today);
  const daysLeftInWeek = 7 - (weekday === 0 ? 6 : weekday - 1);

  const advice = weeklyAdvice({
    sessionsThisWeek: state.consistency.sessionsThisWeek,
    weekTarget: state.consistency.weekTarget,
    run: state.consistency.run,
    weeksOnTarget: state.consistency.weeksOnTarget,
    slopePerWeek: weight.slopePerWeek,
    lastSkipReason: state.consistency.lastSkipReason,
    floorKept: floorDone,
    daysLeftInWeek,
  });

  const save = async () => {
    setBusy(true);
    try {
      const parsedWeight = Number(weightText);
      if (weightText.trim() && Number.isFinite(parsedWeight) && parsedWeight > 0) {
        await actions.logWeight(parsedWeight);
      }
      const parsedWaist = Number(waistText);
      if (waistText.trim() && Number.isFinite(parsedWaist) && parsedWaist > 0) {
        await actions.logWaist(parsedWaist);
      }
      if (floorDone !== null && floorDone !== floorThisWeek) {
        await actions.logSteps(floorDone);
      }
      router.replace('/');
    } catch {
      setBusy(false);
    }
  };

  const recentWeights = state.weights.slice(-7);

  return (
    <Screen>
      <Masthead
        title="Review"
        back={() => router.back()}
        right={shortDay(today).toLocaleUpperCase()}
      />
      <Rule strong />

      <View style={{ gap: space.xs }}>
        <T variant="display">One page a week.</T>
        <T variant="body" style={{ color: color.inkSoft }}>
          Numbers in, one change out. It takes three minutes and it is the only appointment that is
          not training.
        </T>
      </View>

      <View style={{ flexDirection: 'row', gap: space.lg }}>
        <Stat
          label="SESSIONS"
          value={`${state.consistency.sessionsThisWeek}/${state.consistency.weekTarget}`}
        />
        <Stat label="IN A ROW" value={String(state.consistency.run)} />
        <Stat label="WEEKS HIT" value={String(state.consistency.weeksOnTarget)} />
      </View>

      <Rule strong />

      <Field
        label="WEIGHT THIS MORNING"
        value={weightText}
        onChangeText={setWeightText}
        keyboardType="decimal-pad"
        placeholder="—"
        suffix="kg"
        right={weight.latest ? `LAST ${oneDecimal(weight.latest)}` : 'FIRST READING'}
        hint={
          weight.slopePerWeek !== null
            ? `Seven day average ${oneDecimal(weight.latest ?? 0)} kg, ${signed(weight.slopePerWeek)} kg per week.`
            : 'One reading is water. Seven is a trend.'
        }
      />

      <Field
        label="WAIST AT THE NAVEL"
        value={waistText}
        onChangeText={setWaistText}
        keyboardType="decimal-pad"
        placeholder="—"
        suffix="cm"
        right={waist.latest ? `LAST ${oneDecimal(waist.latest)}` : 'FIRST READING'}
        hint={
          waist.change !== null
            ? `First reading ${oneDecimal((waist.latest ?? 0) - waist.change)} cm, now ${oneDecimal(waist.latest ?? 0)} cm.`
            : 'Three readings, same spot, breathe out, take the middle one.'
        }
      />

      <View style={{ gap: space.sm }}>
        <T variant="chapter">THE FLOOR, KEPT?</T>
        <T variant="small">8,000 steps and 140 g protein. One tap, no food diary.</T>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Choice
            label="Kept it"
            selected={floorDone === true}
            onPress={() => setFloorDone(true)}
          />
          <Choice
            label="Not this week"
            selected={floorDone === false}
            onPress={() => setFloorDone(false)}
          />
        </View>
      </View>

      <Rule strong />

      <View style={{ gap: space.sm }}>
        <SectionHead label="THE ONE CHANGE" right="ONE, NEVER THREE" />
        <T variant="title">{advice.title}</T>
        <T variant="body" style={{ color: color.inkSoft }}>
          {advice.body}
        </T>
      </View>

      {recentWeights.length >= 3 ? (
        <View style={{ gap: space.xs }}>
          <T variant="chapter">SEVEN DAYS, AS WRITTEN</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {recentWeights.map((entry) => (
              <T key={entry.day} variant="figureSmall">
                {shortDay(entry.day)} {oneDecimal(entry.kg)}
              </T>
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ flex: 1 }} />

      <PrimaryButton label={busy ? 'Writing' : 'Close the week'} disabled={busy} onPress={save} />
      <LinkRow
        label="The full ledger"
        detail="Every event, as written"
        onPress={() => router.push('/log')}
      />
      <T variant="micro">
        Week of {shortDay(weekStart)} · last session{' '}
        {state.records.length > 0
          ? shortDay(state.records[state.records.length - 1]!.day)
          : 'not yet'}
      </T>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <T variant="chapter">{label}</T>
      <T variant="value">{value}</T>
    </View>
  );
}
