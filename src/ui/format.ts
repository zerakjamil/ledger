import { daysBetween, parseDay, todayKey } from '../domain/consistency';

export function longDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

/** SUN 25 OCT, the way a diary stamps a page. */
export function pageDate(date: Date): string {
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(date);
  const rest = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(date);
  return `${weekday} ${rest}`.toLocaleUpperCase();
}

export function shortDay(day: string): string {
  const d = parseDay(day);
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(
    new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

/** MON 26 OCT: a day spoken the way a diary writes it. */
export function dayStamp(day: string): string {
  const d = parseDay(day);
  const local = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(local);
  const rest = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(local);
  return `${weekday} ${rest}`.toLocaleUpperCase();
}

/** Monday first, matching the week the app counts. */
export const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export function agoLabel(iso: string): string {
  const day = iso.slice(0, 10);
  const diff = daysBetween(day, todayKey());
  if (diff <= 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff < 7) return `${diff} days ago`;
  if (diff < 14) return 'last week';
  return `${Math.floor(diff / 7)} weeks ago`;
}

export function kg(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

/** Bodyweight and waist always read to one decimal: 90.0, not 90. */
export function oneDecimal(value: number): string {
  return value.toFixed(1);
}

export function signed(value: number, digits = 1): string {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return (0).toFixed(digits);
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(digits)}`;
}

export function clockLabel(hour: number, minute: number): string {
  const h = String(hour).padStart(2, '0');
  const m = String(minute).padStart(2, '0');
  return `${h}:${m}`;
}

/** 03:41 for a session clock. */
export function elapsedLabel(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function restLabel(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
