import { describeLoad } from './equipment';
import { MOVEMENTS, SESSIONS } from './program';
import { nextSession } from './rotation';
import type { AppState } from './state';
import type { SessionKey } from './types';

/**
 * The line that turns a reminder into a workout.
 *
 * "Train tonight" asks the user to remember what training means, open the app
 * and read the page. This asks them to pick up the dumbbells. The phone already
 * knows the load, so there is no reason to make the lock screen vague.
 *
 * Only the next session is described. A week of prescriptions projected forward
 * would be a guess the moment one appointment moves, and a reminder that lies
 * about the weight is worse than one that says nothing.
 */
export function sessionBrief(
  state: AppState,
  now: Date = new Date(),
): { key: SessionKey; text: string } | null {
  const last = state.records.length > 0 ? state.records[state.records.length - 1]! : null;
  const key = nextSession(last, now).key;
  const first = SESSIONS[key].movementIds[0];
  if (!first) return null;

  const movement = MOVEMENTS[first];
  const prescription = state.prescriptions[first]?.prescription;
  if (!movement || !prescription) return null;

  const unit = movement.unit === 'seconds' ? 's' : '';
  const load = describeLoad(movement, prescription.loadKg);
  return {
    key,
    text: `Set 1 of ${key}: ${movement.name}, ${prescription.sets} × ${prescription.target}${unit}, ${load}.`,
  };
}
