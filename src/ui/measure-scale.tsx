import { View, type StyleProp, type ViewStyle } from 'react-native';
import { MEASURE_RANGE, tapeOverflow, tapePosition, type Measure } from '../domain/measure';
import { color } from '../theme/tokens';
import { T } from './kit';

/**
 * A printed tape, not a picker.
 *
 * The ruler-picker pattern (react-native-ruler-picker, the native body metric
 * rulers) is built for browsing a value you do not know yet: you flick until
 * the hairline lands on it. Here the number is known, typed from a tape you
 * just used, so a picker would only add drag distance. What the number cannot
 * do on its own is show where it sits, and that is the failure this screen had:
 * 34 looked like a number, and only a scale makes it look like a mistake.
 *
 * So the tape is a readout: fixed range, fixed ticks, one needle that moves as
 * the digits arrive. An off-tape reading parks the needle on the end in rust.
 */
const TAPE: Record<Measure, { step: number; labels: readonly number[] }> = {
  waist: { step: 10, labels: [50, 100, 150, 200] },
  weight: { step: 10, labels: [30, 100, 200, 300] },
};

export function MeasureScale({
  measure,
  value,
  style,
}: {
  measure: Measure;
  value: number | null;
  style?: StyleProp<ViewStyle>;
}) {
  const { floor, ceiling, unit } = MEASURE_RANGE[measure];
  const { step, labels } = TAPE[measure];

  const ticks: number[] = [];
  for (let at = floor; at <= ceiling; at += step) ticks.push(at);

  const pct = value === null ? null : tapePosition(measure, value);
  const over = value === null ? null : tapeOverflow(measure, value);
  const needle = over === null ? color.ink : color.rust;

  const spoken =
    value === null
      ? `${measure} tape, ${floor} to ${ceiling} ${unit}`
      : `${measure}, ${value} ${unit}${over ? ', off the tape' : ''}`;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={spoken}
      style={[{ height: 40, marginTop: 8 }, style]}
    >
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 15,
          height: 1,
          backgroundColor: color.rule,
        }}
      />

      {ticks.map((tick) => {
        const major = labels.includes(tick);
        return (
          <View
            key={tick}
            style={{
              position: 'absolute',
              bottom: 15,
              left: `${tapePosition(measure, tick) * 100}%`,
              marginLeft: -0.5,
              width: 1,
              height: major ? 10 : 5,
              backgroundColor: major ? color.inkFaint : color.ruleStrong,
            }}
          />
        );
      })}

      {labels.map((label) => (
        <View
          key={label}
          style={{
            position: 'absolute',
            bottom: 0,
            left: `${tapePosition(measure, label) * 100}%`,
            width: 34,
            marginLeft: -17,
          }}
        >
          <T
            variant="figureSmall"
            style={{ fontSize: 9.5, lineHeight: 12, textAlign: 'center', color: color.inkFaint }}
          >
            {label}
          </T>
        </View>
      ))}

      {pct === null ? null : (
        <View
          style={{
            position: 'absolute',
            bottom: 15,
            left: `${pct * 100}%`,
            marginLeft: -4,
            width: 8,
            alignItems: 'center',
          }}
        >
          <View style={{ width: 8, height: 2, backgroundColor: needle }} />
          <View style={{ width: 2, height: 14, backgroundColor: needle }} />
        </View>
      )}
    </View>
  );
}
