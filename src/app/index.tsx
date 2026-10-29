import { useRouter } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';
import { todayKey, weekdayOf } from '../domain/consistency';
import { closedBy, dayPlan, weekShortfall } from '../domain/day';
import { movementById } from '../domain/library';
import { FLOOR_SESSION, SESSIONS } from '../domain/program';
import { activeRepair, lastChance } from '../domain/repair';
import { prescriptionFor, slotTarget, waistTrend, weightTrend } from '../domain/state';
import { weekView } from '../domain/week';
import { useStore } from '../state/provider';
import { color, space } from '../theme/tokens';
import { clockLabel, dayStamp, kg, oneDecimal, pageDate, signed } from '../ui/format';
import {
  LinkRow,
  Masthead,
  Notice,
  PrimaryButton,
  QuietButton,
  Rule,
  Screen,
  SectionHead,
  T,
  WeekStrip,
} from '../ui/kit';

export default function Home() {
  const router = useRouter();
  const { state, ready, actions } = useStore();

  if (!ready) {
    return (
      <Screen>
        <Masthead right={pageDate(new Date())} />
        <Rule strong />
        <T variant="title">Opening the ledger</T>
      </Screen>
    );
  }

  if (!state.contract) {
    return <Cover />;
  }

  const now = new Date();
  const today = todayKey(now);
  const plan = dayPlan(state, today, now);
  const closed = closedBy(state, today);
  const repair = activeRepair(state, today);
  const repairingToday = repair?.day === today;
  const lastChanceDay = !repairingToday && lastChance(state, today);
  /** The last day the week can still be saved puts the floor session first. */
  const floorFirst = repairingToday || lastChanceDay;
  const session = SESSIONS[plan.key];
  /** The slot ids are the program's; the movements are whatever each slot holds. */
  const slotIds = repairingToday ? FLOOR_SESSION : session.movementIds;
  const movements = slotIds.map((id) => movementById(slotTarget(state, id))!);
  const totalSets = movements.reduce((sum, movement) => {
    const sets = prescriptionFor(state, movement).sets;
    return sum + (repairingToday ? Math.min(2, sets) : sets);
  }, 0);
  const consistency = state.consistency;
  const waist = waistTrend(state.waists);
  const weight = weightTrend(state.weights);
  const week = weekView(state);
  const restDay = plan.kind === 'rest';
  /**
   * `plan.missed` measures the week before today, which is the right question
   * when deciding whether today can be a make-up. On a closed day it is stale:
   * a session written today may already have made the week whole, and a chapter
   * that still says ONE PAGE SHORT after the page was written is the ledger
   * arguing with itself. Ask the inclusive measure once the day is written.
   */
  const chapterShort =
    plan.because === 'closed' ? weekShortfall(state, state.contract.days, today) : plan.missed;
  /** The floor clears at a clock time, which is the only number worth showing on a rest day. */
  const readyAt = new Date(now.getTime() + plan.hoursUntilReady * 3_600_000);
  const rewardText = state.contract.reward.trim();
  const repairLine = rewardText
    ? `The page you skipped is still open. Ten minutes is enough, and it unlocks “${rewardText}”.`
    : 'The page you skipped is still open. Ten minutes is enough.';

  /**
   * A booked commitment has to be cancellable where it is shown. The alert
   * stops a stray tap from quietly deleting the plan, and the copy is honest
   * about what cancellation costs.
   */
  const cancelRepair = () => {
    Alert.alert(
      'Cancel the repair?',
      'The page stays short. You can still train another day this week.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel the repair',
          style: 'destructive',
          onPress: () => void actions.cancelRepair(),
        },
      ],
    );
  };


  return (
    <Screen>
      <Masthead title="Ledger" right={pageDate(now)} />
      <Rule strong />

      <WeekStrip
        days={week}
        caption={`${consistency.sessionsThisWeek} of ${consistency.weekTarget} written this week`}
      />

      {repair && !repairingToday ? (
        <View style={{ gap: space.xs }}>
          <SectionHead
            label="REPAIR BOOKED"
            right={`${dayStamp(repair.day)} · ${clockLabel(repair.hour, repair.minute)}`}
          />
          <T variant="small">
            One ten minute session and the week is whole. The alarm will meet you there.
          </T>
          <QuietButton label="Cancel the repair" onPress={cancelRepair} />
        </View>
      ) : null}

      {chapterShort > 0 ? (
        <T variant="chapter" style={{ color: color.rust }}>
          {chapterShort === 1 ? 'ONE PAGE SHORT' : `${chapterShort} PAGES SHORT`}
        </T>
      ) : null}

      <Rule />

      <View style={{ gap: space.sm }}>
        <SectionHead
          label={
            restDay
              ? 'REST DAY'
              : repairingToday
                ? 'REPAIR'
                : plan.kind === 'makeup'
                  ? 'SHORT THIS WEEK'
                  : 'TODAY'
          }
          right={
            restDay
              ? plan.nextDay
                ? dayStamp(plan.nextDay)
                : '—'
              : repairingToday && repair
                ? `${dayStamp(repair.day)} · ${clockLabel(repair.hour, repair.minute)}`
                : `SESSION ${plan.key}`
          }
        />
        <T variant="display">
          {restDay
            ? 'Nothing to lift.'
            : repairingToday
              ? 'Ten minutes closes the week.'
              : session.title}
        </T>
        {restDay ? (
          <T variant="body" style={{ color: color.inkSoft }}>
            {plan.because === 'closed'
              ? closed === 'skip'
                ? `The skip is written. The next appointment is ${plan.nextDay ? dayStamp(plan.nextDay) : 'not set'}, session ${plan.key}.`
                : `Today is written. The next appointment is ${plan.nextDay ? dayStamp(plan.nextDay) : 'not set'}, session ${plan.key}.`
              : plan.because === 'recovery' && plan.nextDay === today
                ? `The last session is still being paid for. Twenty hours between sessions is the floor, so the page opens again at ${clockLabel(readyAt.getHours(), readyAt.getMinutes())}.`
                : `${plan.nextDay ? dayStamp(plan.nextDay) : 'The next appointment'} is when the page opens. The rotation already knows which session it is.`}
          </T>
        ) : repairingToday ? (
          <T variant="body" style={{ color: color.inkSoft }}>
            {repairLine}
          </T>
        ) : (
          /**
           * Temptation bundling has to arrive before the effort, not after it.
           * It takes the line the movement count used, rather than adding one:
           * the count is already in the table and in the note above the button,
           * and a primary action pushed below the fold is a bug.
           */
          <T variant="small" style={{ color: rewardText ? color.rustDeep : color.inkSoft }}>
            {plan.kind === 'makeup'
              ? lastChanceDay
                ? 'One page short this week. Ten minutes closes it.'
                : `${plan.missed === 1 ? 'One page' : `${plan.missed} pages`} short this week. ${plan.missed === 1 ? 'One session closes the gap.' : 'Start with one now.'}`
              : rewardText
                ? `Set 1 unlocks “${rewardText}”`
                : `${movements.length} movements · ${totalSets} sets`}
          </T>
        )}
      </View>

      {restDay ? (
        <View style={{ gap: space.sm }}>
          <View style={styles.head}>
            <T variant="chapter" style={{ flex: 1 }}>
              NEXT PAGE · {plan.key}
            </T>
            <T variant="chapter" style={styles.colPlan}>
              SETS × REPS
            </T>
          </View>
          <Rule />
          {movements.map((movement, index) => {
            const prescription = prescriptionFor(state, movement);
            return (
              <Pressable
                key={movement.id}
                accessibilityRole="link"
                accessibilityLabel={`${movement.name}. Opens the form page.`}
                onPress={() =>
                  router.push({
                    pathname: '/form/[id]',
                    params: { id: movement.id, slot: slotIds[index] },
                  })
                }
                style={({ pressed }) => [pressed && styles.rowPressed]}
              >
                <View style={styles.line}>
                  <T variant="figureSmall" style={styles.index}>
                    {String(index + 1).padStart(2, '0')}
                  </T>
                  <T variant="body" style={[styles.rowLink, styles.rowName]} numberOfLines={2}>
                    {breakSafe(movement.name)}
                  </T>
                  <T variant="figure" style={styles.colPlan}>
                    {prescription.sets} × {prescription.target}
                    {movement.unit === 'seconds' ? 's' : ''}
                  </T>
                </View>
                <Rule />
              </Pressable>
            );
          })}
          <T variant="small">
            {session.title} · {session.movementIds.length} movements · {totalSets} sets. Roughly
            forty minutes, and the first set is the only one that needs deciding.
          </T>
        </View>
      ) : (
        <View>
          <View style={styles.head}>
            <T variant="chapter" style={{ flex: 1 }}>
              MOVEMENT
            </T>
            <T variant="chapter" style={styles.colSets}>
              SETS
            </T>
            <T variant="chapter" style={styles.colReps}>
              REPS
            </T>
            <T variant="chapter" style={styles.colLoad}>
              KG
            </T>
          </View>
          <Rule />
          {movements.map((movement, index) => {
            const prescription = prescriptionFor(state, movement);
            return (
              <Pressable
                key={movement.id}
                accessibilityRole="link"
                accessibilityLabel={`${movement.name}. Opens the form page.`}
                onPress={() =>
                  router.push({
                    pathname: '/form/[id]',
                    params: { id: movement.id, slot: slotIds[index] },
                  })
                }
                style={({ pressed }) => [pressed && styles.rowPressed]}
              >
                <View style={styles.line}>
                  <T variant="figureSmall" style={styles.index}>
                    {String(index + 1).padStart(2, '0')}
                  </T>
                  <T variant="body" style={[styles.rowLink, styles.rowName]} numberOfLines={2}>
                    {breakSafe(movement.name)}
                  </T>
                  <T variant="figure" style={styles.colSets}>
                    {repairingToday ? Math.min(2, prescription.sets) : prescription.sets}
                  </T>
                  <T variant="figure" style={styles.colReps}>
                    {prescription.target}
                    {movement.unit === 'seconds' ? 's' : ''}
                  </T>
                  <T variant="figure" style={styles.colLoad}>
                    {movement.loading.kind === 'bodyweight'
                      ? '—'
                      : movement.loading.kind === 'dumbbell' && movement.loading.hands === 2
                        ? `2×${kg(prescription.loadKg)}`
                        : kg(prescription.loadKg)}
                  </T>
                </View>
                <Rule />
              </Pressable>
            );
          })}
        </View>
      )}

      {restDay ? (
        /**
         * A closed day offers nothing, because the twenty hour floor is the
         * app's own rule and a second session tonight would break it. A day with
         * no appointment ahead is the only rest day where starting early is honest.
         */
        plan.because === 'none' ? (
          <QuietButton
            label="Start early anyway"
            onPress={() =>
              router.push({ pathname: '/session', params: { key: plan.key, kind: 'full' } })
            }
          />
        ) : null
      ) : (
        <View style={{ gap: space.xs }}>
          <PrimaryButton
            label={
              repairingToday
                ? 'Start the repair'
                : lastChanceDay
                  ? 'Ten minutes closes the week'
                  : 'Start session'
            }
            note={
              repairingToday
                ? `ten minutes · ${totalSets} sets`
                : lastChanceDay
                  ? 'one floor session, then it is whole'
                  : 'about 40 minutes'
            }
            onPress={() =>
              floorFirst
                ? router.push({ pathname: '/session', params: { key: plan.key, kind: 'floor' } })
                : router.push({ pathname: '/gate', params: { key: plan.key, kind: 'full' } })
            }
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <QuietButton
              label={floorFirst ? 'Full session' : 'Ten minute version'}
              onPress={() =>
                floorFirst
                  ? router.push({ pathname: '/gate', params: { key: plan.key, kind: 'full' } })
                  : router.push({ pathname: '/session', params: { key: plan.key, kind: 'floor' } })
              }
            />
            <QuietButton
              label="Not today"
              onPress={() =>
                router.push({ pathname: '/skip', params: { tokens: String(consistency.tokensLeft) } })
              }
            />
          </View>
          <T variant="micro">
            The deal is set 1. The other sets are yours to take.
          </T>
        </View>
      )}

      <Rule strong />

      <View style={{ gap: space.s }}>
        <SectionHead label="THE TWO NUMBERS" right={`${consistency.weeksOnTarget} WEEKS ON TARGET`} />
        <View style={{ flexDirection: 'row', gap: space.lg }}>
          <Figure
            label="WAIST"
            value={waist.latest ? oneDecimal(waist.latest) : '—'}
            unit="cm"
            note={
              waist.change !== null
                ? `${signed(waist.change)} since the first reading`
                : 'first reading, navel height'
            }
          />
          <Figure
            label="WEIGHT"
            value={weight.latest ? oneDecimal(weight.latest) : '—'}
            unit="kg"
            note={
              weight.slopePerWeek !== null
                ? `${signed(weight.slopePerWeek)} kg per week`
                : state.weights.length > 1
                  ? `${state.weights.length} readings, no trend yet`
                  : 'one reading is water'
            }
          />
        </View>
        <T variant="small">
          Waist once a week, at the navel, breathe out. Weight daily, read the average, never the day.
        </T>
      </View>

      <Rule />

      {weekdayOf(today) === 0 ||
      weekdayOf(today) === 6 ||
      consistency.sessionsThisWeek >= consistency.weekTarget ? (
        <LinkRow
          label="Close the week"
          detail="Three numbers in, one change out"
          onPress={() => router.push('/review')}
        />
      ) : null}

      <LinkRow
        label="Settings"
        detail="Plates, the appointment, notifications"
        onPress={() => router.push('/settings')}
      />

      <View style={{ gap: space.xs }}>
        <SectionHead label="THE CONTRACT" right={clockLabel(state.contract.hour, state.contract.minute)} />
        <T variant="quote">“{state.contract.ifText}”</T>
        <T variant="micro">
          {consistency.tokensLeft} skip tokens left this month · {state.eventCount} events written
        </T>
      </View>

      {state.records.length > 0 ? (
        <View style={{ gap: 2 }}>
          <SectionHead label="LAST WRITTEN" />
          <T variant="small">
            {state.records[state.records.length - 1]!.key} ·{' '}
            {SESSIONS[state.records[state.records.length - 1]!.key].title}
            {state.records[state.records.length - 1]!.kind === 'floor' ? ' · floor session' : ''}
          </T>
        </View>
      ) : null}

      <View style={{ height: space.xl }} />
    </Screen>
  );
}

/** Keeps "push-up" together when the table is narrow. */
function breakSafe(name: string): string {
  return name.replaceAll('-', '\u2011');
}

function Figure({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: string;
  unit: string;
  note: string;
}) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <T variant="chapter">{label}</T>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <T variant="value">{value}</T>
        <T variant="figureSmall">{unit}</T>
      </View>
      <T variant="micro">{note}</T>
    </View>
  );
}

function Cover() {
  const router = useRouter();
  return (
    <Screen>
      <Masthead right="NO. 001" />
      <Rule strong />

      <View style={{ gap: space.md, paddingTop: space.lg }}>
        <T variant="display">A training log that refuses to be ignored.</T>
        <T variant="body" style={{ color: color.inkSoft }}>
          Three sessions a week with a bench, a bar, and two dumbbells. No account, no server, no
          cloud. It works in a basement with no signal.
        </T>
      </View>

      <Rule />

      <View style={{ gap: space.md }}>
        {[
          ['01', 'Write the contract', 'Two numbers, your plates, and the sentence you read at 7pm.'],
          ['02', 'Train on rotation', 'A, B, C. A missed Tuesday is absorbed, not punished.'],
          ['03', 'Read one number', 'Waist and weight average. One change a week, never three.'],
        ].map(([index, title, body]) => (
          <View key={index} style={{ flexDirection: 'row', gap: space.md }}>
            <T variant="figureSmall" style={{ width: 20, color: color.rust }}>
              {index}
            </T>
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="heading">{title}</T>
              <T variant="small">{body}</T>
            </View>
          </View>
        ))}
      </View>

      <PrimaryButton label="Write the contract" onPress={() => router.push('/onboarding')} note="four minutes" />

      <Notice>
        Nothing here leaves the phone. The event log is yours to export at any time, as plain JSON.
      </Notice>
    </Screen>
  );
}

const styles = {
  head: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    paddingBottom: space.sm,
  },
  line: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: space.s,
    gap: space.sm,
    minHeight: 48,
  },
  index: { width: 18, color: color.inkFaint },
  /**
   * The name column takes the space the numbers do not. Without `flexShrink`,
   * a long movement name pushes the three figures past the right edge, and the
   * load column is the first thing to disappear.
   */
  rowName: { flex: 1, flexShrink: 1 },
  colSets: { width: 32, textAlign: 'right' as const },
  colReps: { width: 42, textAlign: 'right' as const },
  /** Wide enough for `2×27.5`, the longest load the kit can build. */
  colLoad: { width: 68, textAlign: 'right' as const },
  colPlan: { width: 84, textAlign: 'right' as const, letterSpacing: 0.6 },
  rowLink: { textDecorationLine: 'underline' as const, textDecorationColor: color.ruleStrong },
  rowPressed: { backgroundColor: color.paperDeep },
};
