import {
  computeConsistency,
  daysBetween,
  todayKey,
  type Consistency,
  type DayEntry,
} from './consistency';
import { HOME_KIT } from './equipment';
import { advance } from './progression';
import { MOVEMENTS, initialPrescription } from './program';
import type {
  Equipment,
  Prescription,
  ProgressionReason,
  SessionKey,
  SessionRecord,
  SetResult,
} from './types';

export type EventType =
  | 'contract.set'
  | 'equipment.set'
  | 'session.finish'
  | 'skip'
  | 'repair.book'
  | 'repair.cancel'
  | 'weigh'
  | 'waist'
  | 'steps'
  | 'setting.set';

export interface AppEvent {
  id?: number;
  at: string;
  /** Local calendar day, YYYY-MM-DD. */
  day: string;
  type: EventType;
  payload: Record<string, unknown>;
}

export interface Contract {
  days: number[];
  hour: number;
  minute: number;
  ifText: string;
  reward: string;
  stake: string;
  createdAt: string;
}

export interface PrescriptionState {
  prescription: Prescription;
  stalls: number;
  lastReason: ProgressionReason | null;
}

export interface WeighIn {
  day: string;
  kg: number;
}

export interface WaistIn {
  day: string;
  cm: number;
}

export interface SkipRecord {
  day: string;
  reason: string;
  protected: boolean;
}

/**
 * A ten minute session the user booked instead of letting a skip end the week.
 * It is a plan, not a page: only a finished session writes anything.
 */
export interface RepairRecord {
  /** The day the skip was written. */
  bookedOn: string;
  /** The day the ten minutes were booked for. */
  day: string;
  hour: number;
  minute: number;
}

export interface AppState {
  contract: Contract | null;
  equipment: Equipment;
  prescriptions: Record<string, PrescriptionState>;
  records: SessionRecord[];
  entries: DayEntry[];
  weights: WeighIn[];
  waists: WaistIn[];
  stepDays: string[];
  skips: SkipRecord[];
  /** The booked ten minute repair, if one is still live. */
  repair: RepairRecord | null;
  /** Results of the most recent finished session, keyed by movement. */
  lastResults: Record<string, SetResult[]>;
  eventCount: number;
  consistency: Consistency;
}

export function reduceEvents(events: readonly AppEvent[], today = todayKey()): AppState {
  let equipment: Equipment = HOME_KIT;
  let contract: Contract | null = null;
  let prescriptions = seed(equipment);
  const records: SessionRecord[] = [];
  /**
   * One page a day. The contract is three pages a week and a page is a day, so
   * a second session on the same day must not push a second record or move the
   * rotation twice: that would burn a session the week never got to see. The
   * event stays in the log either way, so no work is lost if the rule changes.
   */
  const sessionDays = new Set<string>();
  const weights: WeighIn[] = [];
  const waists: WaistIn[] = [];
  const stepDays: string[] = [];
  const skips: SkipRecord[] = [];
  let repair: RepairRecord | null = null;
  let lastResults: Record<string, SetResult[]> = {};

  const ordered = [...events].sort((a, b) => a.at.localeCompare(b.at));

  for (const event of ordered) {
    switch (event.type) {
      case 'equipment.set': {
        const next = event.payload as unknown as Equipment;
        if (typeof next?.barKg === 'number' && Array.isArray(next.platePairsKg)) {
          equipment = next;
        }
        break;
      }
      case 'contract.set': {
        contract = event.payload as unknown as Contract;
        break;
      }
      case 'session.finish': {
        if (sessionDays.has(event.day)) break;
        sessionDays.add(event.day);
        const key = event.payload.key as SessionKey;
        const kind = event.payload.kind === 'floor' ? 'floor' : 'full';
        records.push({ key, kind, at: event.at, day: event.day });
        const results = (event.payload.results ?? {}) as Record<string, SetResult[]>;
        lastResults = results;
        for (const [movementId, sets] of Object.entries(results)) {
          const movement = MOVEMENTS[movementId];
          const current = prescriptions[movementId];
          if (!movement || !current || !Array.isArray(sets)) continue;
          const out = advance(
            { movement, prev: current.prescription, results: sets, stalls: current.stalls },
            equipment,
          );
          prescriptions[movementId] = {
            prescription: out.next,
            stalls: out.stalls,
            lastReason: out.reason,
          };
        }
        break;
      }
      case 'skip': {
        skips.push({
          day: event.day,
          reason: String(event.payload.reason ?? ''),
          protected: event.payload.protected === true,
        });
        break;
      }
      case 'repair.book': {
        const day = String(event.payload.day ?? '');
        const hour = Number(event.payload.hour);
        const minute = Number(event.payload.minute);
        if (
          /^\d{4}-\d{2}-\d{2}$/.test(day) &&
          Number.isInteger(hour) &&
          hour >= 0 &&
          hour <= 23 &&
          Number.isInteger(minute) &&
          minute >= 0 &&
          minute <= 59
        ) {
          repair = { bookedOn: event.day, day, hour, minute };
        }
        break;
      }
      case 'repair.cancel': {
        repair = null;
        break;
      }
      case 'weigh': {
        const kg = Number(event.payload.kg);
        if (Number.isFinite(kg) && kg > 0) weights.push({ day: event.day, kg });
        break;
      }
      case 'waist': {
        const cm = Number(event.payload.cm);
        if (Number.isFinite(cm) && cm > 0) waists.push({ day: event.day, cm });
        break;
      }
      case 'steps': {
        if (event.payload.ok === true && !stepDays.includes(event.day)) stepDays.push(event.day);
        break;
      }
      default:
        break;
    }
  }

  const entries: DayEntry[] = ordered.flatMap((event): DayEntry[] => {
    if (event.type === 'session.finish') {
      return [
        {
          day: event.day,
          kind: event.payload.kind === 'floor' ? ('floor' as const) : ('full' as const),
        },
      ];
    }
    if (event.type === 'skip') {
      const protectedSkip = event.payload.protected === true;
      return [
        {
          day: event.day,
          kind: protectedSkip ? ('skip-protected' as const) : ('skip' as const),
          reason: String(event.payload.reason ?? ''),
        },
      ];
    }
    return [];
  });

  return {
    contract,
    equipment,
    prescriptions,
    records,
    entries,
    weights,
    waists,
    stepDays,
    skips,
    repair,
    lastResults,
    eventCount: ordered.length,
    /** The contract names the target. A two day contract is judged on two. */
    consistency: computeConsistency(entries, today, Math.max(1, contract?.days.length ?? 3)),
  };
}

function seed(equipment: Equipment): Record<string, PrescriptionState> {
  const out: Record<string, PrescriptionState> = {};
  for (const movement of Object.values(MOVEMENTS)) {
    out[movement.id] = {
      prescription: initialPrescription(movement, equipment),
      stalls: 0,
      lastReason: null,
    };
  }
  return out;
}

/** Seven day trailing average, so a salty dinner is not read as fat gain. */
export function weightTrend(weights: readonly WeighIn[]): { latest: number | null; slopePerWeek: number | null } {
  if (weights.length === 0) return { latest: null, slopePerWeek: null };
  const sorted = [...weights].sort((a, b) => a.day.localeCompare(b.day));
  const latestWeek = sorted.slice(-7);
  const latest = round(latestWeek.reduce((s, w) => s + w.kg, 0) / latestWeek.length);

  if (sorted.length < 10) return { latest, slopePerWeek: null };
  const firstWeek = sorted.slice(0, 7);
  const first = firstWeek.reduce((s, w) => s + w.kg, 0) / firstWeek.length;
  const days = daysBetween(sorted[0]!.day, sorted[sorted.length - 1]!.day);
  if (days <= 0) return { latest, slopePerWeek: null };
  const perWeek = ((latest - first) / days) * 7;
  return { latest, slopePerWeek: round(perWeek) };
}

export function waistTrend(waists: readonly WaistIn[]): { latest: number | null; change: number | null } {
  if (waists.length === 0) return { latest: null, change: null };
  const sorted = [...waists].sort((a, b) => a.day.localeCompare(b.day));
  const latest = sorted[sorted.length - 1]!.cm;
  const change = sorted.length > 1 ? round(latest - sorted[0]!.cm) : null;
  return { latest, change };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
