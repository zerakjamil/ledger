import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, mono, rule, sans, space, type } from '../theme/tokens';

type Variant = keyof typeof type;

export function T({
  variant = 'body',
  style,
  children,
  numberOfLines,
}: {
  variant?: Variant;
  style?: TextStyle | TextStyle[];
  children: React.ReactNode;
  numberOfLines?: number;
}) {
  return (
    <Text style={[type[variant], style]} numberOfLines={numberOfLines} allowFontScaling>
      {children}
    </Text>
  );
}

export function Screen({
  children,
  scroll = true,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
}) {
  const inner = (
    <View style={[styles.page, scroll ? styles.flow : styles.fixed, style]}>{children}</View>
  );
  // Android draws edge to edge now, so the bottom edge matters as much as the
  // top one: without it the last line of a page sits under the navigation bar.
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

/**
 * The top of every page.
 *
 * Two slots, two jobs, and neither of them is a secret. `back` replaces the
 * wordmark with a back tab in the top left, where the rest of the platform puts
 * it. `onRight` turns the right slot into a bordered tab, because plain rust
 * text sitting where plain rust text usually sits is not an affordance.
 */
export function Masthead({
  title = 'Ledger',
  right,
  onRight,
  back,
}: {
  title?: string;
  right?: string;
  onRight?: () => void;
  back?: () => void;
}) {
  return (
    <View style={styles.masthead}>
      {back ? (
        <Pressable
          onPress={back}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [styles.backTab, pressed && styles.tabPressed]}
        >
          <Text style={styles.backLabel}>{'‹'} Back</Text>
        </Pressable>
      ) : (
        <T variant="chapter" style={styles.wordmark}>
          {title}
        </T>
      )}
      {right ? (
        onRight ? (
          <Pressable
            onPress={onRight}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={right}
            style={({ pressed }) => [styles.headTab, pressed && styles.tabPressed]}
          >
            <Text style={styles.headTabLabel}>{right}</Text>
          </Pressable>
        ) : (
          <T variant="chapter">{right}</T>
        )
      ) : null}
    </View>
  );
}

export function SectionHead({ label, right }: { label: string; right?: string }) {
  return (
    <View style={styles.sectionHead}>
      <T variant="chapter">{label}</T>
      {right ? <T variant="figureSmall">{right}</T> : null}
    </View>
  );
}

export function Rule({ strong = false, style }: { strong?: boolean; style?: ViewStyle }) {
  return (
    <View
      style={[
        { height: strong ? rule.thick : rule.thin, backgroundColor: strong ? color.ruleStrong : color.rule },
        style,
      ]}
    />
  );
}

/** A rubber stamp: outlined, rotated, quietly loud. Used for completed work only. */
export function Stamp({ label, tone = 'rust' }: { label: string; tone?: 'rust' | 'moss' | 'faint' }) {
  const tint = tone === 'moss' ? color.moss : tone === 'faint' ? color.inkFaint : color.rust;
  return (
    <View style={[styles.stamp, { borderColor: tint }]}>
      <Text style={[styles.stampLabel, { color: tint }]}>{label}</Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  note,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  note?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primary,
        pressed && { backgroundColor: color.rustDeep },
        disabled && styles.primaryDisabled,
      ]}
    >
      <Text style={[styles.primaryLabel, disabled && { color: color.inkFaint }]}>{label}</Text>
      {note ? <Text style={styles.primaryNote}>{note}</Text> : null}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.secondary,
        pressed && { backgroundColor: color.paperDeep },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text style={styles.secondaryLabel}>{label}</Text>
    </Pressable>
  );
}

export function QuietButton({
  label,
  onPress,
  tone = 'ink',
}: {
  label: string;
  onPress: () => void;
  tone?: 'ink' | 'rust';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.quiet, pressed && { opacity: 0.55 }]}
    >
      <View style={styles.quietRule}>
        <Text style={[styles.quietLabel, tone === 'rust' && { color: color.rust }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  suffix,
  right,
  multiline,
  error,
  below,
  ...props
}: TextInputProps & {
  label: string;
  hint?: string;
  suffix?: string;
  right?: string;
  /** A filled field that cannot be used says why, under the line it is on. */
  error?: string | null;
  /** A scale or diagram that belongs to this number, not to the prose under it. */
  below?: React.ReactNode;
}) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <T variant="chapter">{label}</T>
        {right ? <T variant="chapter">{right}</T> : null}
      </View>
      <View style={[styles.fieldRow, multiline && styles.fieldRowMultiline, error && styles.fieldRowError]}>
        <TextInput
          {...props}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={[styles.input, multiline && styles.inputMultiline]}
          placeholderTextColor={color.inkFaint}
          selectionColor={color.rust}
          keyboardAppearance="light"
        />
        {suffix ? <T variant="figureSmall">{suffix}</T> : null}
      </View>
      {below}
      {error ? (
        <T variant="small" style={{ color: color.rust }}>
          {error}
        </T>
      ) : null}
      {hint ? <T variant="small">{hint}</T> : null}
    </View>
  );
}

/** One tappable answer in a row of answers. Big enough for a thumb at 6am. */
export function Choice({
  label,
  note,
  selected,
  onPress,
  flex = 1,
}: {
  label: string;
  note?: string;
  selected: boolean;
  onPress: () => void;
  flex?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={note ? `${label}, ${note}` : label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        { flex },
        selected && styles.choiceOn,
        pressed && !selected && { backgroundColor: color.paperDeep },
      ]}
    >
      <Text style={[styles.choiceLabel, selected && { color: color.paper }]}>{label}</Text>
      {note ? (
        <Text style={[styles.choiceNote, selected && { color: color.rustWash }]}>{note}</Text>
      ) : null}
    </Pressable>
  );
}

export type DayState = 'done' | 'floor' | 'skip' | 'missed' | 'today' | 'planned' | 'rest';

/** Seven cells, the way a diary shows a week. */
export function WeekStrip({
  days,
  caption,
}: {
  days: readonly { label: string; state: DayState }[];
  caption: string;
}) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.week}>
        {days.map((day, index) => {
          const done = day.state === 'done';
          const floor = day.state === 'floor';
          const today = day.state === 'today';
          const missed = day.state === 'missed';
          const skipped = day.state === 'skip';
          const planned = day.state === 'planned';
          const rest = day.state === 'rest';
          const filled = done || floor;
          return (
            <View
              key={`${day.label}-${index}`}
              style={[
                styles.day,
                planned && { borderColor: color.ruleStrong },
                rest && { borderColor: color.rule },
                missed && { borderColor: color.rust },
                today && { borderColor: color.rust, borderWidth: 2 },
                done && { backgroundColor: color.ink, borderColor: color.ink },
                floor && { backgroundColor: color.moss, borderColor: color.moss },
                today && filled && { borderColor: color.rust, borderWidth: 2 },
              ]}
            >
              <Text
                style={[
                  styles.dayLabel,
                  planned && { color: color.inkSoft },
                  filled && { color: color.paper, fontWeight: '700' },
                  missed && { color: color.rust },
                  today && { color: color.rust, fontWeight: '700' },
                ]}
              >
                {day.label}
              </Text>
              {skipped ? (
                <View style={styles.dayDash} />
              ) : (
                <View
                  style={[
                    styles.dayDot,
                    filled && { backgroundColor: color.paper },
                    today && { backgroundColor: color.rust },
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>
      <T variant="figureSmall">{caption}</T>
    </View>
  );
}

export function Notice({ children, tone = 'ink' }: { children: React.ReactNode; tone?: 'ink' | 'rust' }) {
  return (
    <View style={[styles.notice, tone === 'rust' && { borderLeftColor: color.rust }]}>
      <T variant="small" style={tone === 'rust' ? { color: color.rustDeep } : undefined}>
        {children}
      </T>
    </View>
  );
}

/** A row that opens something. The arrow is the only affordance paper needs. */
export function LinkRow({ label, detail, onPress }: { label: string; detail?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.55 }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="body">{label}</T>
        {detail ? <T variant="micro">{detail}</T> : null}
      </View>
      <Text style={styles.linkArrow}>{'›'}</Text>
    </Pressable>
  );
}

export function Row({
  left,
  right,
  style,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.row, style]}>
      <View style={{ flex: 1, gap: 2 }}>{left}</View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.paper },
  scroll: { flexGrow: 1 },
  fixed: { flex: 1 },
  flow: { flexGrow: 1 },
  page: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.lg,
    gap: space.lg,
    backgroundColor: color.paper,
  },
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 24,
  },
  wordmark: { letterSpacing: 4, color: color.rust },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.md,
  },
  stamp: {
    borderWidth: 1.5,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    transform: [{ rotate: '-2deg' }],
    alignSelf: 'flex-start',
  },
  stampLabel: {
    fontFamily: mono,
    fontSize: 10.5,
    letterSpacing: 1.6,
    fontWeight: '700',
  },
  primary: {
    backgroundColor: color.rust,
    minHeight: 60,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    gap: 2,
  },
  primaryDisabled: { backgroundColor: color.paperDeep, borderWidth: 1, borderColor: color.rule },
  primaryLabel: {
    fontFamily: sans,
    fontSize: 17,
    fontWeight: '600',
    color: color.paper,
    letterSpacing: 0.2,
  },
  primaryNote: {
    fontFamily: mono,
    fontSize: 11,
    letterSpacing: 0.4,
    color: color.rustWash,
  },
  secondary: {
    minHeight: 52,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  secondaryLabel: { fontFamily: sans, fontSize: 15, fontWeight: '600', color: color.ink },
  quiet: { minHeight: 44, justifyContent: 'center' },
  // A quiet button is underlined, because on this page an unadorned line of
  // text is a sentence and a sentence is not a control.
  quietRule: {
    alignSelf: 'flex-start',
    borderBottomWidth: rule.thin,
    borderBottomColor: color.ruleStrong,
    paddingBottom: 1,
  },
  quietLabel: { fontFamily: sans, fontSize: 14.5, color: color.inkSoft },
  backTab: { minHeight: 30, justifyContent: 'center', paddingRight: space.s, marginLeft: -2 },
  backLabel: { fontFamily: mono, fontSize: 11, letterSpacing: 1.2, color: color.rust },
  headTab: {
    borderWidth: rule.thin,
    borderColor: color.ruleStrong,
    paddingHorizontal: space.s,
    paddingVertical: 3,
    minHeight: 26,
    justifyContent: 'center',
  },
  headTabLabel: { fontFamily: mono, fontSize: 10.5, letterSpacing: 1.2, color: color.rust },
  tabPressed: { backgroundColor: color.paperDeep },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderBottomWidth: rule.thin,
    borderBottomColor: color.ruleStrong,
    paddingBottom: 4,
  },
  fieldRowError: { borderBottomColor: color.rust },
  fieldRowMultiline: { alignItems: 'flex-start', paddingTop: 4 },
  input: {
    flex: 1,
    fontFamily: mono,
    fontSize: 22,
    color: color.ink,
    paddingVertical: 6,
    fontVariant: ['tabular-nums'],
  },
  inputMultiline: {
    fontFamily: sans,
    fontSize: 15,
    lineHeight: 21,
    minHeight: 52,
    paddingTop: 4,
  },
  choice: {
    minHeight: 52,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: color.rule,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    gap: 1,
  },
  choiceOn: { backgroundColor: color.ink, borderColor: color.ink },
  choiceLabel: { fontFamily: sans, fontSize: 15, fontWeight: '600', color: color.ink },
  choiceNote: { fontFamily: sans, fontSize: 10.5, color: color.inkFaint },
  week: { flexDirection: 'row', gap: space.xs },
  day: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: color.rule,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dayLabel: {
    fontFamily: mono,
    fontSize: 11,
    letterSpacing: 0.8,
    color: color.inkSoft,
  },
  dayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
  dayDash: { width: 10, height: 2, backgroundColor: color.rust, opacity: 0.6 },
  notice: {
    backgroundColor: color.raised,
    borderLeftWidth: 2,
    borderLeftColor: color.ruleStrong,
    paddingHorizontal: space.md,
    paddingVertical: space.s,
    borderRadius: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 48,
    borderBottomWidth: rule.thin,
    borderBottomColor: color.rule,
    paddingVertical: space.s,
  },
  linkArrow: { fontFamily: mono, fontSize: 15, color: color.rust },
});
