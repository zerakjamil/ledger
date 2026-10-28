import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Image, StyleSheet, View } from 'react-native';
import { describeLoad } from '../../domain/equipment';
import { isShelfMovement, movementById, programSlot, slotOfMovement } from '../../domain/library';
import { useStore } from '../../state/provider';
import { mono, space } from '../../theme/tokens';
import { demoNote, plateFor } from '../../ui/movementArt';
import { LinkRow, Masthead, Rule, Screen, T } from '../../ui/kit';

/**
 * The page you turn to mid-session when you cannot remember what the set is
 * supposed to look like. It carries the loop, the setup differences from the
 * demo, and the three things that decide whether a rep counts.
 *
 * A shelf movement opens the same page. Its three cues are the first three
 * steps from the catalog, and the slot line says what it replaced.
 */
export default function FormPage() {
  const router = useRouter();
  const { id, slot: slotParam, from } = useLocalSearchParams<{
    id: string;
    slot?: string;
    from?: string;
  }>();
  const { state, actions } = useStore();

  const movement = typeof id === 'string' ? movementById(id) : null;
  const slot =
    (typeof slotParam === 'string' ? programSlot(slotParam) : null) ??
    (movement ? slotOfMovement(state.slots, movement.id) : null);
  const replaced = slot && movement && slot.id !== movement.id ? slot.movement : null;
  const plate = movement ? plateFor(movement.id) : null;
  const note = movement ? demoNote(movement.id) : null;
  /** Shelf art is 180 px square. At full width it is only soft paper. */
  const shelfArt = movement ? isShelfMovement(movement.id) : false;
  const prescription = movement ? state.prescriptions[movement.id]?.prescription : undefined;
  /** A swap is a decision for before the page, not between two sets. */
  const inSession = from === 'session';

  /**
   * The way back. Without this, a swap is a one-way door unless you remember
   * which shelf movement is standing in the slot and open its page again.
   */
  const restore = () => {
    if (!slot || !replaced) return;
    Alert.alert(
      `Put ${replaced.name} back?`,
      'The original kept its numbers the whole time. This movement leaves the plan.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Put it back',
          onPress: () => {
            void actions.setSlot(slot.id, replaced.id).catch(() => {
              Alert.alert('The slot did not change.', 'The ledger is still on the old movement.');
            });
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <Masthead title="Form" back={() => router.back()} />
      <Rule strong />

      {!movement ? (
        <T variant="body">There is no page for that movement.</T>
      ) : (
        <>
          <View style={{ gap: space.xs }}>
            <T variant="chapter">THE MOVEMENT</T>
            <T variant="title">{movement.name}</T>
            {prescription ? (
              <T variant="figure">
                {prescription.sets} × {prescription.target}
                {movement.unit === 'seconds' ? 's' : ''} ·{' '}
                {describeLoad(movement, prescription.loadKg)}
              </T>
            ) : null}
            {replaced ? (
              <T variant="micro">
                In the plan, in place of {replaced.name}. The original keeps its numbers.
              </T>
            ) : null}
          </View>

          <Rule strong />

          {plate ? (
            /**
             * No frame and no card. The loop's background is the page colour, so
             * the figure sits directly on the paper like a plate inked into it.
             */
            <View style={{ gap: space.sm }}>
              <Image
                source={plate}
                style={[styles.plate, shelfArt && styles.shelfPlate]}
                resizeMode="contain"
                accessible
                accessibilityLabel={`${movement.name}, looping demonstration`}
              />
              <T variant="micro">
                {note ?? 'The loop is the rep: the start, the working position, and back again.'}
              </T>
            </View>
          ) : (
            <T variant="small">No picture for this one. The cues below carry it.</T>
          )}

          <Rule strong />

          <View style={{ gap: space.s }}>
            <T variant="chapter">{movement.pattern === 'other' ? 'HOW IT GOES' : 'ON THE PAGE'}</T>
            {(movement.cues ?? []).map((cue, index) => (
              <View key={index} style={{ flexDirection: 'row', gap: space.s }}>
                <T variant="micro" style={{ fontFamily: mono, paddingTop: 3 }}>
                  {String(index + 1).padStart(2, '0')}
                </T>
                <T variant="body" style={{ flex: 1 }}>
                  {cue}
                </T>
              </View>
            ))}
          </View>

          {slot ? (
            <>
              <Rule />
              <View style={{ gap: space.xs }}>
                <T variant="chapter">
                  IN THE PLAN · {slot.session} · {String(slot.index + 1).padStart(2, '0')}
                </T>
                <T variant="small">
                  {replaced
                    ? `This page stands in for ${replaced.name}. The original keeps its numbers.`
                    : `The plan files this in session ${slot.session}, position ${slot.index + 1}.`}
                </T>
              </View>
              {inSession ? null : (
                <>
                  <LinkRow
                    label="Replace this movement"
                    detail="Search every movement the room can load"
                    onPress={() =>
                      router.push({ pathname: '/movements', params: { slot: slot.id } })
                    }
                  />
                  {replaced ? (
                    <LinkRow
                      label={`Put ${replaced.name} back`}
                      detail="The original numbers are still there"
                      onPress={restore}
                    />
                  ) : null}
                </>
              )}
            </>
          ) : null}

          <Rule />

          <T variant="micro">
            Demonstration © Gym visual, from the exercises-dataset collection. Duotoned to the ink and
            paper of this page and bundled for personal use.
          </T>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  plate: { width: '100%', aspectRatio: 1 },
  shelfPlate: { maxWidth: 300, alignSelf: 'center' },
});
