import { File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { exportLog } from '../db/events';
import { todayKey } from '../domain/consistency';
import { SESSIONS } from '../domain/program';
import { debts } from '../domain/debt';
import { useStore } from '../state/provider';
import { color, space } from '../theme/tokens';
import { oneDecimal, shortDay } from '../ui/format';
import {
  Masthead,
  Notice,
  PrimaryButton,
  QuietButton,
  Rule,
  Screen,
  T,
} from '../ui/kit';

type Mark = 'FULL' | 'FLOOR' | 'SKIP' | 'KG' | 'CM' | 'STEPS';

interface Line {
  at: string;
  day: string;
  label: string;
  detail: string;
  mark: Mark;
}

export default function Log() {
  const router = useRouter();
  const { state } = useStore();
  const [busy, setBusy] = useState(false);

  const lines: Line[] = [
    ...state.records.map((record) => ({
      at: record.at,
      day: record.day,
      label: `${record.key} · ${SESSIONS[record.key].title}`,
      detail: record.kind === 'floor' ? 'Three movements, two sets each' : 'Every set as prescribed',
      mark: (record.kind === 'floor' ? 'FLOOR' : 'FULL') as Mark,
    })),
    ...state.skips.map((skip) => ({
      at: `${skip.day}T12:00:00.000Z`,
      day: skip.day,
      label: 'Skipped',
      detail: `${skip.reason}${skip.protected ? ' · token used' : ' · run reset'}`,
      mark: 'SKIP' as Mark,
    })),
    ...state.weights.map((weigh) => ({
      at: `${weigh.day}T07:00:00.000Z`,
      day: weigh.day,
      label: 'Weigh-in',
      detail: `${oneDecimal(weigh.kg)} kg, morning, before food`,
      mark: 'KG' as Mark,
    })),
    ...state.waists.map((waist) => ({
      at: `${waist.day}T07:30:00.000Z`,
      day: waist.day,
      label: 'Waist at the navel',
      detail: `${oneDecimal(waist.cm)} cm, standing, breathed out`,
      mark: 'CM' as Mark,
    })),
    ...state.stepDays.map((day) => ({
      at: `${day}T21:00:00.000Z`,
      day,
      label: 'The floor, kept',
      detail: '8,000 steps and 140 g protein',
      mark: 'STEPS' as Mark,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const share = async () => {
    setBusy(true);
    try {
      const json = await exportLog();
      const file = new File(Paths.cache, `ledger-${todayKey()}-${Date.now()}.json`);
      file.write(json);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Export the ledger',
          UTI: 'public.json',
        });
      } else {
        Alert.alert('Saved', file.uri);
      }
    } catch (cause) {
      Alert.alert('Export failed', cause instanceof Error ? cause.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Masthead title="The ledger" back={() => router.back()} />
      <Rule strong />

      <View style={{ gap: space.xs }}>
        <T variant="display">Every line, in order.</T>
        <T variant="small">
          Each prescription in the app is recomputed from this list on every open. There is no other
          copy of the truth, and the file is yours to export.
        </T>
      </View>

      <View style={{ flexDirection: 'row', gap: space.lg }}>
        <Count label="PAGES" value={String(state.consistency.daysShown)} />
        <Count label="UNPAID" value={String(debts(state).total)} />
        <Count label="EVENTS" value={String(state.eventCount)} />
      </View>

      <T variant="micro">
        {state.consistency.daysShown === 0
          ? 'Every page is a vote. The first one is still blank.'
          : state.consistency.daysShown === 1
            ? 'Every page is a vote. You have cast one.'
            : `Every page is a vote. You have cast ${state.consistency.daysShown}.`}
      </T>

      <Rule strong />

      {lines.length === 0 ? (
        <View style={{ gap: space.xs, paddingVertical: space.lg }}>
          <T variant="body">Nothing written yet.</T>
          <T variant="small">The first line is the one that counts.</T>
        </View>
      ) : (
        <View>
          <View style={{ flexDirection: 'row', paddingBottom: space.sm }}>
            <T variant="chapter" style={{ width: 62 }}>
              DATE
            </T>
            <T variant="chapter" style={{ flex: 1 }}>
              ENTRY
            </T>
            <T variant="chapter" style={{ width: 62, textAlign: 'right' }}>
              MARK
            </T>
          </View>
          <Rule />
          {lines.map((line, index) => (
            <View key={`${line.at}-${index}`}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  paddingVertical: space.s,
                  gap: space.sm,
                  minHeight: 48,
                }}
              >
                <T variant="figureSmall" style={{ width: 62 }}>
                  {shortDay(line.day)}
                </T>
                <View style={{ flex: 1, gap: 1 }}>
                  <T variant="body">{line.label}</T>
                  <T variant="micro">{line.detail}</T>
                </View>
                <T
                  variant="figureSmall"
                  style={{
                    width: 62,
                    textAlign: 'right',
                    color:
                      line.mark === 'SKIP'
                        ? color.rust
                        : line.mark === 'FLOOR'
                          ? color.moss
                          : line.mark === 'KG' || line.mark === 'CM'
                            ? color.inkSoft
                            : color.ink,
                  }}
                >
                  {line.mark}
                </T>
              </View>
              <Rule />
            </View>
          ))}
        </View>
      )}

      <View style={{ flex: 1 }} />

      <PrimaryButton label={busy ? 'Packing' : 'Export as JSON'} disabled={busy} onPress={share} />
      <Notice>
        Plain JSON, every event, no interpretation. If this app disappears tomorrow the training
        history survives.
      </Notice>
    </Screen>
  );
}

function Count({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <T variant="chapter">{label}</T>
      <T variant="value">{value}</T>
    </View>
  );
}
