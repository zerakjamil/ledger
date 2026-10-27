import { ROTATION } from './program';
import type { SessionKey, SessionRecord } from './types';

const MIN_REST_HOURS = 20;

export interface NextSession {
  key: SessionKey;
  kind: 'next' | 'rest';
  hoursSinceLast: number | null;
  hoursUntilReady: number;
}

/**
 * Rotation, not weekday locking. A missed Tuesday does not break a week, and
 * two sessions inside 20 hours do not count as discipline.
 */
export function nextSession(last: SessionRecord | null, now: Date): NextSession {
  if (!last) {
    return { key: 'A', kind: 'next', hoursSinceLast: null, hoursUntilReady: 0 };
  }
  const hoursSinceLast = (now.getTime() - new Date(last.at).getTime()) / 3_600_000;
  const index = ROTATION.indexOf(last.key);
  const key = ROTATION[(index + 1) % ROTATION.length]!;
  if (hoursSinceLast < MIN_REST_HOURS) {
    return {
      key,
      kind: 'rest',
      hoursSinceLast,
      hoursUntilReady: Math.ceil(MIN_REST_HOURS - hoursSinceLast),
    };
  }
  return { key, kind: 'next', hoursSinceLast, hoursUntilReady: 0 };
}

export function sessionsThisWeek(records: readonly SessionRecord[], weekStart: Date, now: Date): number {
  return records.filter((r) => {
    const at = new Date(r.at).getTime();
    return at >= weekStart.getTime() && at <= now.getTime();
  }).length;
}
