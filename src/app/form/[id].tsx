import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, View } from 'react-native';
import { describeLoad } from '../../domain/equipment';
import { MOVEMENTS } from '../../domain/program';
import { useStore } from '../../state/provider';
import { mono, space } from '../../theme/tokens';
import { demoNote, plateFor } from '../../ui/movementArt';
import { Masthead, Rule, Screen, T } from '../../ui/kit';

/**
 * The page you turn to mid-session when you cannot remember what the set is
 * supposed to look like. It carries the loop, the setup differences from the
 * demo, and the three things that decide whether a rep counts.
 */
export default function FormPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useStore();

  const movement = typeof id === 'string' ? MOVEMENTS[id] : undefined;
  const plate = movement ? plateFor(movement.id) : null;
  const note = movement ? demoNote(movement.id) : null;
  const prescription = movement ? state.prescriptions[movement.id]?.prescription : undefined;

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
                style={{ width: '100%', aspectRatio: 1 }}
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
            <T variant="chapter">ON THE PAGE</T>
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
