import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { debts } from '../domain/debt';
import { repairOffer } from '../domain/repair';
import { nextSession } from '../domain/rotation';
import { useStore } from '../state/provider';
import { color, space } from '../theme/tokens';
import { clockLabel, dayStamp } from '../ui/format';
import {
  Masthead,
  PrimaryButton,
  QuietButton,
  Rule,
  Screen,
  SecondaryButton,
  SectionHead,
  T,
} from '../ui/kit';

const REASONS = ['Work ran late', 'Too tired', 'Something hurts', 'Family needed me', 'No time', 'Just not today'];

export default function Skip() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tokens?: string }>();
  const { state, actions } = useStore();
  const tokens = Number(params.tokens ?? state.consistency.tokensLeft);
  const canProtect = tokens > 0;
  const unpaid = debts(state);
  const stake = state.contract?.stake.trim();
  const reward = state.contract?.reward.trim();
  const sentence = state.contract?.ifText.trim();
  /**
   * The offer is computed before the skip is written, and it treats today's
   * appointment as skipped. If one page is all that is missing and no
   * appointment is left, the skip page can leave the week with a plan instead
   * of only a price.
   */
  const offer = repairOffer(state);
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const last = state.records.length > 0 ? state.records[state.records.length - 1]! : null;
  const next = nextSession(last, new Date());

  const confirm = async (withRepair: boolean) => {
    if (!reason) return;
    setBusy(true);
    try {
      await actions.skipToday(reason, canProtect, withRepair && offer ? offer : undefined);
      router.replace('/');
    } catch {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Masthead title="Not today" back={() => router.back()} />
      <Rule strong />

      <View style={{ gap: space.sm, paddingTop: space.sm }}>
        <T variant="display">Ten minutes first?</T>
        <T variant="body" style={{ color: color.inkSoft }}>
          The short version is three movements, two sets each. It keeps the run exactly like a full
          session does, without pretending you had forty minutes.
        </T>
      </View>

      <PrimaryButton
        label="Do the ten minute version"
        note={`${next.key} · 3 movements · 2 sets`}
        onPress={() => router.replace({ pathname: '/session', params: { key: next.key, kind: 'floor' } })}
      />

      <Rule strong />

      {sentence ? (
        <View style={{ gap: space.sm }}>
          <SectionHead label="THE SENTENCE YOU SIGNED" />
          <T variant="quote">“{sentence}”</T>
        </View>
      ) : null}

      <Rule />

      <View style={{ gap: space.sm }}>
        <SectionHead label="IF NOT, WHY" right={canProtect ? `${tokens} TOKENS LEFT` : 'NO TOKENS LEFT'} />
        {reward ? (
          <T variant="micro" style={{ color: color.inkSoft }}>
            The session would have unlocked “{reward}”. A skip does not.
          </T>
        ) : null}
        {stake ? (
          <T variant="micro" style={{ color: canProtect ? color.inkSoft : color.rustDeep }}>
            {canProtect
              ? `A token covers it. Without one, the price you wrote is: ${stake}`
              : `The price is due: ${stake} This makes ${unpaid.total + 1} pages unpaid.`}
          </T>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {REASONS.map((option) => {
            const on = reason === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => setReason(option)}
                style={{
                  width: '48.5%',
                  minHeight: 52,
                  justifyContent: 'center',
                  paddingHorizontal: space.s,
                  borderWidth: 1,
                  borderColor: on ? color.ink : color.rule,
                  backgroundColor: on ? color.paperDeep : 'transparent',
                }}
              >
                <T variant="small" style={{ color: on ? color.ink : color.inkSoft }}>
                  {option}
                </T>
              </Pressable>
            );
          })}
        </View>
      </View>

      {offer ? (
        <View style={{ gap: space.sm }}>
          <Rule strong />
          <SectionHead label="THE WEEK CAN STILL BE WHOLE" right={dayStamp(offer.day)} />
          <T variant="body">
            One ten minute session at {clockLabel(offer.hour, offer.minute)} closes the page. Book it
            and the app will meet you there.
          </T>
          <T variant="micro">
            A floor session writes the page; it cannot move a weight. The skip stays written either
            way.
          </T>
        </View>
      ) : null}

      <T variant="small">
        {canProtect
          ? `This uses one of your ${tokens} skip tokens. The run stays. Two a month, no questions asked.`
          : 'No tokens left this month, so the run resets to zero. Days shown never reset, so the ledger still knows what you have done.'}
      </T>

      {offer ? (
        <View style={{ gap: space.sm }}>
          <PrimaryButton
            label={busy ? 'Writing' : 'Book the repair'}
            note={`${dayStamp(offer.day)} · ${clockLabel(offer.hour, offer.minute)} · ten minutes`}
            disabled={!reason || busy}
            onPress={() => confirm(true)}
          />
          <SecondaryButton
            label={busy ? 'Writing' : 'Close the day without it'}
            disabled={!reason || busy}
            onPress={() => confirm(false)}
          />
        </View>
      ) : (
        <SecondaryButton
          label={busy ? 'Writing' : canProtect ? 'Use a token and close the day' : 'Close the day'}
          disabled={!reason || busy}
          onPress={() => confirm(false)}
        />
      )}

      <View style={{ flex: 1 }} />

      <QuietButton label="Back to the ledger" onPress={() => router.back()} />
      <T variant="micro">
        {offer
          ? `${next.key} waits. The repair writes the page; this skip does not.`
          : `${next.key} waits. Skipping does not move the rotation.`}
      </T>
    </Screen>
  );
}
