import { CameraView, useCameraPermissions } from 'expo-camera';
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Linking, StyleSheet, View } from 'react-native';
import { todayKey } from '../domain/consistency';
import { gradeLabel, scoreLine, unavailable, type GateVerdict } from '../domain/gate';
import { gateFor } from '../domain/state';
import { detectorInstalled, keep, read } from '../services/gate';
import { useStore } from '../state/provider';
import { color, mono, rule, space } from '../theme/tokens';
import { Masthead, PrimaryButton, QuietButton, Rule, Screen, Stamp, T } from '../ui/kit';

type Phase = 'aim' | 'checking' | 'open' | 'shut' | 'blind' | 'naked' | 'undoing' | 'undone';

/**
 * The gate.
 *
 * A photograph is the cheapest thing that cannot be argued with at 7pm: the app
 * does not ask whether you feel like training, it asks whether you are in the
 * room. The photo is kept, so the weekly review can put the face next to the
 * number, and the ladder stops the moment this page says yes.
 *
 * Two doors, and both of them are doors. Showing the weight is the fast one.
 * Spending the token is the expensive one. There is no third door where the
 * phone is dismissed and nothing is written, because that is the door the whole
 * app was built to close.
 */
export default function Gate() {
  useKeepAwake();
  const router = useRouter();
  const params = useLocalSearchParams<{ key?: string; kind?: string }>();
  const { state, ready, actions } = useStore();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [phase, setPhase] = useState<Phase>('aim');
  const [shot, setShot] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<GateVerdict | null>(null);
  const [live, setLive] = useState(false);
  const [slow, setSlow] = useState(false);
  const [armed, setArmed] = useState(false);
  /**
   * The aim page does not scroll and the preview takes the slack, so the shutter
   * sits above the bottom edge on every height Android ships. A button that
   * needs a scroll at 7pm is a gate that lets the evening through.
   */

  const today = todayKey();
  const already = ready ? gateFor(state, today) : null;
  const next = {
    pathname: '/session' as const,
    params: { key: params.key, kind: params.kind ?? 'full' },
  };

  /**
   * A camera that never reports ready would leave the user holding a dead
   * rectangle at the exact moment they were willing to train. Ten seconds is
   * long enough for a cold sensor, short enough to admit the truth.
   */
  useEffect(() => {
    if (live || phase !== 'aim' || !permission?.granted) return;
    const timer = setTimeout(() => setSlow(true), 10_000);
    return () => clearTimeout(timer);
  }, [live, phase, permission?.granted]);

  /**
   * The shutter waits a moment after the preview comes alive. Granting the
   * camera permission is a tap on the same glass, and Android can hand the
   * release of that tap to the screen underneath: a gate that photographs the
   * ceiling the instant you allow the camera is not a gate, it is a formality
   * with a shutter. The delay is short enough to feel like nothing and long
   * enough that the photo is always a decision.
   */
  useEffect(() => {
    if (!live || phase !== 'aim') {
      setArmed(false);
      return;
    }
    const timer = setTimeout(() => setArmed(true), 900);
    return () => clearTimeout(timer);
  }, [live, phase]);

  const open = async (result: Extract<GateVerdict, { pass: true }>, photo: string | null) => {
    const receipt = photo ? await keep(photo, today) : null;
    await actions.passGate(result.grade, receipt, result.scores);
    setPhase('open');
  };

  const shoot = async () => {
    if (!camera.current || phase !== 'aim') return;
    try {
      const picture = await camera.current.takePictureAsync({ quality: 0.55, shutterSound: false });
      if (!picture?.uri) {
        setPhase('blind');
        return;
      }
      setShot(picture.uri);
      setPhase('checking');
      const result = await read(picture.uri);
      setVerdict(result);
      /**
       * No detector means the photo proves that a button was pressed. That is
       * still allowed to open the gate, because the alternative is a phone that
       * cannot be used until a model exists, but it is never allowed to do it
       * quietly: the user says "unchecked" out loud, or spends the token.
       */
      if (result.pass && result.grade === 'unverified') setPhase('naked');
      else if (result.pass) await open(result, picture.uri);
      else setPhase('shut');
    } catch {
      setPhase('blind');
    }
  };

  const again = () => {
    setShot(null);
    setVerdict(null);
    setSlow(false);
    setPhase('aim');
  };

  /**
   * The camera is not on screen for either of these. Undo used to drop the user
   * straight back onto a live shutter, and the release of the confirming tap
   * landed on it: a photo of the ceiling one second after asking to take the
   * pass back. Nothing to press until the screen is asked to show a camera.
   */
  if (phase === 'undoing') {
    return (
      <Screen>
        <Masthead title="The gate" back={() => router.back()} />
        <T variant="title" style={styles.headline}>
          Taking the pass back
        </T>
        <T variant="body" style={styles.prose}>
          Deleting the photo and starting today's alarms again.
        </T>
      </Screen>
    );
  }

  if (phase === 'undone') {
    return (
      <Screen>
        <Masthead title="The gate" back={() => router.back()} />
        <T variant="title" style={styles.headline}>
          Taken back
        </T>
        <T variant="body" style={styles.prose}>
          Today's record and its photo are gone, and the alarms start again from now. Sit down with
          the dumbbell, then open the gate.
        </T>
        <PrimaryButton label="Open the gate" onPress={again} />
        <QuietButton label="Back to the page" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (already) {
    return (
      <Screen>
        <Masthead title="The gate" back={() => router.back()} />
        <View style={styles.opened}>
          <Stamp label="Open" />
          <T variant="title" style={styles.openedTitle}>
            You already showed up
          </T>
          <T variant="body" style={styles.prose}>
            {gradeLabel(already.grade)} at {timeOf(already.at)}. The phone is quiet. Go and train.
          </T>
          {already.scores ? (
            <T variant="figureSmall" style={styles.scores}>
              {scoreLine(already.scores)}
            </T>
          ) : null}
        </View>
        <PrimaryButton label="Start session" onPress={() => router.replace(next)} />
        <QuietButton
          label="Undo this pass"
          tone="rust"
          onPress={() =>
            Alert.alert(
              'Undo this pass?',
              "Today's record and its photo are deleted, and today's alarms start again from now. There is no second undo, so this is only worth doing on a pass that was not earned.",
              [
                { text: 'Keep the pass', style: 'cancel' },
                {
                  text: 'Undo it',
                  style: 'destructive',
                  onPress: () => {
                    /** The camera goes away before the write starts, not after it. */
                    setPhase('undoing');
                    void actions
                      .undoGate()
                      .then(() => setPhase('undone'))
                      .catch(() => {
                        setPhase('aim');
                        Alert.alert(
                          'The pass is still open',
                          'The record could not be taken back. Nothing was deleted. Try again.',
                        );
                      });
                  },
                },
              ],
            )
          }
        />
        <QuietButton label="Back to the page" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (!permission) {
    return (
      <Screen>
        <Masthead title="The gate" back={() => router.back()} />
        <T variant="body">Opening the camera.</T>
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen>
        <Masthead title="The gate" back={() => router.back()} />
        <T variant="title" style={styles.headline}>
          The gate needs the camera
        </T>
        <T variant="body" style={styles.prose}>
          No camera means no proof of the room. The other door costs a token, and it is one tap away.
        </T>
        {/**
         * The second attempt is deliberate: Android shows the prompt once, and
         * a refusal on the first night is usually a mis-tap, not a decision.
         */}
        <PrimaryButton
          label={permission.canAskAgain ? 'Allow the camera' : 'Open settings'}
          onPress={() => {
            if (permission.canAskAgain) void requestPermission();
            else void Linking.openSettings();
          }}
        />
        <QuietButton
          label="Spend the token instead"
          tone="rust"
          onPress={() => router.replace({ pathname: '/skip', params: { tokens: String(state.consistency.tokensLeft) } })}
        />
      </Screen>
    );
  }

  if (phase === 'open' && verdict?.pass) {
    const unchecked = verdict.grade === 'unverified';
    return (
      <Screen>
        <Masthead title="The gate" />
        <View style={styles.opened}>
          <Stamp label="Open" tone={unchecked ? 'faint' : 'rust'} />
          <T variant="title" style={styles.openedTitle}>
            {unchecked ? 'You are in. Unchecked.' : 'There you are'}
          </T>
          <T variant="body" style={styles.prose}>
            {unchecked
              ? 'Nothing looked at this one. The ladder is off, and the page will say unchecked, so the record stays honest.'
              : `${gradeLabel(verdict.grade)}. The phone stops ringing now.`}
          </T>
          {verdict.scores ? (
            <T variant="figureSmall" style={styles.scores}>
              {scoreLine(verdict.scores)}
            </T>
          ) : null}
        </View>
        {shot ? <Image source={{ uri: shot }} style={styles.still} resizeMode="cover" /> : null}
        <PrimaryButton label="Start session" onPress={() => router.replace(next)} />
        <QuietButton label="Back to the page" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (phase === 'naked') {
    return (
      <Screen>
        <Masthead title="The gate" back={() => router.back()} />
        <T variant="title" style={styles.headline}>
          Nothing looked at that photo
        </T>
        <T variant="body" style={styles.prose}>
          There is no detector on this phone yet, so the picture proves that you pressed a button. It
          cannot tell a dumbbell from a door handle. Train unchecked and the page will say so forever,
          or spend the token and pay for the evening instead.
        </T>
        {shot ? <Image source={{ uri: shot }} style={styles.still} resizeMode="cover" /> : null}
        <PrimaryButton
          label="Train unchecked"
          onPress={() => {
            if (verdict?.pass) void open(verdict, shot);
          }}
        />
        <QuietButton label="Take another" onPress={again} />
        <QuietButton
          label="Spend the token instead"
          tone="rust"
          onPress={() => router.replace({ pathname: '/skip', params: { tokens: String(state.consistency.tokensLeft) } })}
        />
      </Screen>
    );
  }

  if (phase === 'blind') {
    return (
      <Screen>
        <Masthead title="The gate" back={() => router.back()} />
        <T variant="title" style={styles.headline}>
          The camera did not open
        </T>
        <T variant="body" style={styles.prose}>
          A phone that will not show the room cannot hold you to it. Train anyway and the page records
          that nobody checked, or spend the token if that is the truer answer.
        </T>
        <PrimaryButton
          label="Train unchecked"
          onPress={() => {
            const result = unavailable();
            setVerdict(result);
            void open(result, null);
          }}
        />
        <QuietButton label="Try the camera again" onPress={again} />
        <QuietButton
          label="Spend the token instead"
          tone="rust"
          onPress={() => router.replace({ pathname: '/skip', params: { tokens: String(state.consistency.tokensLeft) } })}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <Masthead title="The gate" back={() => router.back()} />
      <T variant="title" style={styles.headline}>
        Show me you are here
      </T>
      <T variant="body" style={styles.prose}>
        Sit on the bench. Dumbbell in your hand.
      </T>

      {/* Takes what is left instead of what it asked for: the shutter is the page. */}
      <View style={[styles.frame, { flex: 1, minHeight: 160 }]}>
        {shot && phase === 'shut' ? (
          <Image source={{ uri: shot }} style={styles.preview} resizeMode="cover" />
        ) : (
          <CameraView
            ref={camera}
            style={styles.preview}
            facing="front"
            flash="off"
            onCameraReady={() => setLive(true)}
            // A sensor that refuses to mount is the same answer as a shutter that
            // will not fire: the room cannot be proven, so say it now.
            onMountError={() => setPhase('blind')}
          />
        )}
        <View style={styles.corner} pointerEvents="none" />
      </View>

      {phase === 'shut' && verdict && !verdict.pass ? (
        <View style={styles.verdict}>
          <Rule />
          <T variant="heading">{verdict.hint}</T>
          <T variant="figureSmall" style={styles.scores}>
            {scoreLine(verdict.scores)}
          </T>
        </View>
      ) : (
        <T variant="small" style={styles.hint}>
          {phase === 'checking'
            ? 'Reading the photo.'
            : slow && !live
              ? 'The camera is taking its time. If it stays black, the button below is honest about it.'
              : live
                ? detectorInstalled()
                  ? 'Hold the dumbbell up beside your face so both are in the frame.'
                  : 'Dumbbell up beside your face. No detector yet: this photo is not checked.'
                : 'Waiting for the camera.'}
        </T>
      )}

      {phase === 'shut' ? (
        <PrimaryButton label="Take another" onPress={again} />
      ) : (
        <PrimaryButton
          label={phase === 'checking' ? 'Reading' : 'Take the photo'}
          onPress={() => void shoot()}
          disabled={!live || !armed || phase !== 'aim'}
        />
      )}
      {slow && !live ? <QuietButton label="The camera will not open" onPress={() => setPhase('blind')} /> : null}
      <QuietButton
        label="Spend the token instead"
        tone="rust"
        onPress={() => router.replace({ pathname: '/skip', params: { tokens: String(state.consistency.tokensLeft) } })}
      />
    </Screen>
  );
}

/** 19:42, from the stored ISO stamp. The ledger thinks in local clock time. */
function timeOf(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '--:--';
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  headline: { marginTop: space.md },
  prose: { marginTop: space.xs, marginBottom: space.lg },
  frame: {
    borderWidth: rule.thick,
    borderColor: color.ruleStrong,
    backgroundColor: color.ink,
    overflow: 'hidden',
  },
  preview: { flex: 1 },
  corner: {
    position: 'absolute',
    left: '18%',
    right: '18%',
    top: '26%',
    bottom: '18%',
    borderWidth: rule.thin,
    borderColor: color.paper,
    borderStyle: 'dashed',
    opacity: 0.9,
  },
  hint: { marginTop: space.sm, marginBottom: space.md },
  verdict: { marginTop: space.sm, gap: space.xs, marginBottom: space.md },
  scores: { color: color.inkFaint, fontFamily: mono, marginTop: space.xs },
  opened: { marginTop: space.md, gap: space.sm, marginBottom: space.lg },
  openedTitle: { marginTop: space.xs },
  still: {
    width: '100%',
    aspectRatio: 4 / 3,
    marginBottom: space.md,
    backgroundColor: color.paperDeep,
  },
});
