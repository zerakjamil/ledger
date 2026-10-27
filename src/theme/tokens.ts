import { Platform, TextStyle } from 'react-native';

/**
 * Warm paper log. Three voices, all system fonts so nothing ships as an asset
 * and nothing falls back to a missing family:
 *   serif  the page title, the sentence you wrote
 *   sans   prose, labels, buttons
 *   mono   every number, every column, every timestamp
 */
export const color = {
  paper: '#F6F2E9',
  paperDeep: '#EFE7D8',
  raised: '#FBF8F1',
  ink: '#1A1815',
  inkSoft: '#5B544A',
  inkFaint: '#8A8175',
  rule: '#D8D0BF',
  ruleStrong: '#B9AE99',
  rust: '#A6431F',
  rustDeep: '#8C3517',
  rustWash: '#F0E2D8',
  moss: '#3F5A46',
  mossWash: '#E6EDE6',
  danger: '#8C2F1B',
} as const;

export const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });
export const sans = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });
export const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'Menlo' });

/** 4 point grid, with 12 and 20 as the half steps the layout actually uses. */
export const space = { xs: 4, sm: 8, s: 12, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

export const rule = { thin: 1, thick: 2 } as const;

export const type = {
  display: {
    fontFamily: serif,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.8,
    color: color.ink,
  } satisfies TextStyle,
  title: {
    fontFamily: serif,
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.4,
    color: color.ink,
  } satisfies TextStyle,
  quote: {
    fontFamily: serif,
    fontSize: 17,
    lineHeight: 27,
    fontStyle: 'italic',
    color: color.inkSoft,
  } satisfies TextStyle,
  heading: {
    fontFamily: sans,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '600',
    color: color.ink,
  } satisfies TextStyle,
  body: {
    fontFamily: sans,
    fontSize: 15,
    lineHeight: 22,
    color: color.ink,
  } satisfies TextStyle,
  small: {
    fontFamily: sans,
    fontSize: 12.5,
    lineHeight: 18,
    color: color.inkSoft,
  } satisfies TextStyle,
  micro: {
    fontFamily: sans,
    fontSize: 11,
    lineHeight: 15,
    color: color.inkFaint,
  } satisfies TextStyle,
  chapter: {
    fontFamily: mono,
    fontSize: 10.5,
    lineHeight: 15,
    letterSpacing: 1.4,
    color: color.inkSoft,
  } satisfies TextStyle,
  value: {
    fontFamily: mono,
    fontSize: 27,
    lineHeight: 32,
    color: color.ink,
    fontVariant: ['tabular-nums'],
  } satisfies TextStyle,
  figure: {
    fontFamily: mono,
    fontSize: 15,
    lineHeight: 20,
    color: color.ink,
    fontVariant: ['tabular-nums'],
  } satisfies TextStyle,
  figureSmall: {
    fontFamily: mono,
    fontSize: 12.5,
    lineHeight: 18,
    color: color.inkSoft,
    fontVariant: ['tabular-nums'],
  } satisfies TextStyle,
} as const;
