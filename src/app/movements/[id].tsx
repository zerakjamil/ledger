import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { catalogRecord, equipmentLabel, patternLabel } from '../../domain/catalog';
import {
  movementById,
  programSlot,
  PROGRAM_SLOTS,
  slotOfMovement,
  slotsForPattern,
  type ProgramSlot,
} from '../../domain/library';
import { slotTarget } from '../../domain/state';
import { useStore } from '../../state/provider';
import { color, mono, space } from '../../theme/tokens';
import { plateFor } from '../../ui/movementArt';
import { Masthead, Notice, QuietButton, Rule, Screen, Stamp, T } from '../../ui/kit';

/**
 * One movement, at full size.
 *
 * The loop is the reason this page exists. Everything else is the honest
 * version of what the dataset gives: the muscles, the steps, and the slot this
 * movement can take. The list never ran the GIFs; this page runs one.
 */
export default function MovementPage() {
  const router = useRouter();
  const { id, slot: slotParam } = useLocalSearchParams<{ id: string; slot?: string }>();
  const { state, actions } = useStore();

  const record = typeof id === 'string' ? catalogRecord(id) : null;
  const passed = typeof slotParam === 'string' ? programSlot(slotParam) : null;

  if (!record) {
    return (
      <Screen>
        <Masthead title="Shelf" back={() => router.back()} />
        <Rule strong />
        <T variant="body">That movement is not on the shelf.</T>
      </Screen>
    );
  }

  const movement = movementById(record.id)!;
  const plate = plateFor(record.id);
  const fitting = slotsForPattern(movement.pattern);
  const candidates = passed ? [passed] : fitting.length > 0 ? fitting : [...PROGRAM_SLOTS];
  const mismatch = passed ? passed.movement.pattern !== movement.pattern : false;
  const inPlan = slotOfMovement(state.slots, record.id);

  const put = async (slotId: string, movementId: string) => {
    try {
      await actions.setSlot(slotId, movementId);
    } catch {
      Alert.alert('The slot did not change.', 'The ledger is still on the old movement.');
    }
  };

  const assign = (target: ProgramSlot) => {
    Alert.alert(
      `Take ${target.movement.name}'s slot?`,
      `${target.session} · ${String(target.index + 1).padStart(2, '0')}. ${record.name} starts at three sets, two in reserve. ${target.movement.name} keeps its numbers and comes back if you swap it back.`,
      [
        { text: 'Keep the plan', style: 'cancel' },
        {
          text: 'Take the slot',
          onPress: () => void put(target.id, record.id),
        },
      ],
    );
  };

  const restore = (target: ProgramSlot) => {
    Alert.alert(
      `Put ${target.movement.name} back?`,
      'Its old numbers are still there. This movement leaves the plan.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Put it back',
          onPress: () => void put(target.id, target.movement.id),
        },
      ],
    );
  };

  return (
    <Screen>
      <Masthead title="Shelf" back={() => router.back()} />
      <Rule strong />

      <View style={{ gap: space.xs }}>
        <T variant="chapter">
          {record.bodyPart.toUpperCase()} · {equipmentLabel(record)}
        </T>
        <T variant="title">{record.name}</T>
        <T variant="small">
          Targets {record.target}
          {record.secondary.length > 0
            ? `, with ${record.secondary.slice(0, 3).join(', ')}`
            : ''}
          .
        </T>
        <T variant="micro">
          {patternLabel(movement.pattern)} · {movement.unit === 'seconds' ? 'held' : 'reps'}
        </T>
        {inPlan ? <Stamp label="IN THE PLAN" tone="moss" /> : null}
      </View>

      <Rule strong />

      {plate ? (
        <View style={{ gap: space.sm }}>
          <Image
            source={plate}
            style={styles.plate}
            resizeMode="contain"
            accessible
            accessibilityLabel={`${record.name}, looping demonstration`}
          />
          <T variant="micro">
            The loop is the movement: the start, the working position, and back again.
          </T>
        </View>
      ) : (
        <T variant="small">No loop for this one. The steps below carry it.</T>
      )}

      {record.needsRack ? (
        <Notice tone="rust">
          This one needs a rack to unrack. The room has none, so it stays a reference page and
          cannot take a slot.
        </Notice>
      ) : null}

      <Rule strong />

      <View style={{ gap: space.s }}>
        <T variant="chapter">HOW IT GOES</T>
        {record.steps.map((step, index) => (
          <View key={index} style={{ flexDirection: 'row', gap: space.s }}>
            <T variant="micro" style={{ fontFamily: mono, paddingTop: 3 }}>
              {String(index + 1).padStart(2, '0')}
            </T>
            <T variant="body" style={{ flex: 1 }}>
              {step}
            </T>
          </View>
        ))}
      </View>

      {record.needsRack ? null : (
        <>
          <Rule strong />

          <View style={{ gap: space.s }}>
            <T variant="chapter">
              {passed ? 'TAKE THE SLOT' : fitting.length > 0 ? 'TAKE A SLOT' : 'NO MATCHING SLOT'}
            </T>
            {passed ? null : fitting.length > 0 ? (
              <T variant="small">
                A {patternLabel(movement.pattern)} movement. Each slot keeps its own numbers; the
                movement you displace comes back with them.
              </T>
            ) : (
              <T variant="small">
                The plan has no {patternLabel(movement.pattern)} slot, so this is a reference page.
                If you mean to change what a slot trains, take one below.
              </T>
            )}

            {passed && mismatch ? (
              <Notice tone="rust">
                This slot trains {patternLabel(passed.movement.pattern)}. You are putting a{' '}
                {patternLabel(movement.pattern)} movement in it.
              </Notice>
            ) : null}

            {candidates.map((target) => {
              const currentId = slotTarget(state, target.id);
              const current = movementById(currentId);
              const holdsThis = currentId === record.id;
              return (
                <View key={target.id} style={styles.slot}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T variant="chapter">
                      {target.session} · {String(target.index + 1).padStart(2, '0')} ·{' '}
                      {patternLabel(target.movement.pattern).toUpperCase()}
                    </T>
                    <T variant="body">
                      {holdsThis ? record.name : (current?.name ?? target.movement.name)}
                    </T>
                    {holdsThis && target.id !== record.id ? (
                      <T variant="micro">Originally {target.movement.name}</T>
                    ) : null}
                  </View>
                  {holdsThis ? (
                    <Stamp label="IN THE PLAN" tone="moss" />
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Take ${target.movement.name}'s slot`}
                      onPress={() => assign(target)}
                      hitSlop={8}
                      style={({ pressed }) => [styles.take, pressed && styles.takePressed]}
                    >
                      <T variant="chapter" style={{ color: color.rust }}>
                        TAKE
                      </T>
                    </Pressable>
                  )}
                </View>
              );
            })}

            {passed &&
            passed.id !== record.id &&
            slotTarget(state, passed.id) === record.id ? (
              <QuietButton
                label={`Put ${passed.movement.name} back`}
                onPress={() => restore(passed)}
              />
            ) : null}

            {/* Reached from the shelf, with no slot in the link: the way back. */}
            {!passed && inPlan ? (
              <QuietButton
                label={`Put ${inPlan.movement.name} back`}
                onPress={() => restore(inPlan)}
              />
            ) : null}
          </View>
        </>
      )}

      <Rule />

      <T variant="micro">
        Media © Gym visual, from the exercises-dataset collection. Duotoned to the ink and paper of
        this page and bundled for personal use.
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  plate: { width: '100%', aspectRatio: 1, maxWidth: 300, alignSelf: 'center' },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderTopWidth: 1,
    borderTopColor: color.rule,
    paddingVertical: space.s,
  },
  take: {
    borderWidth: 1.5,
    borderColor: color.rust,
    paddingHorizontal: space.s,
    paddingVertical: 7,
  },
  takePressed: { backgroundColor: color.rustWash },
});
