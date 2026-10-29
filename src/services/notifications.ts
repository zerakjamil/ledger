import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  helpAlarmIds,
  NAG_COPY,
  NAG_MINUTES,
  nagIntensity,
  planNotifications,
  type NotificationSpec,
} from '../domain/notifications';
import type { AppState } from '../domain/state';
import { todayKey } from '../domain/consistency';
import { sessionBrief } from '../domain/brief';
import { activeRepair } from '../domain/repair';

const NAG_CHANNELS = { gentle: 'nag-gentle', firm: 'nag-firm', loud: 'nag-loud' } as const;

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('training', {
      name: 'Training',
      // One reminder per training day is the whole product, so it is allowed to
      // reach the top of the screen. Android lets the user quiet it in settings.
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      enableVibrate: true,
      vibrationPattern: [0, 180],
      lightColor: '#A6431F',
    });
    /**
     * The ladder gets its own channels because Android freezes a channel's
     * importance the moment it is created: changing it later is a no-op, and
     * deleting and recreating the same id resets the user's choices. Three
     * fixed rungs, decided once, is the only honest way to escalate.
     */
    await Notifications.setNotificationChannelAsync(NAG_CHANNELS.gentle, {
      name: 'Training, first nudge',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
      enableVibrate: true,
      vibrationPattern: [0, 120],
      lightColor: '#A6431F',
    });
    await Notifications.setNotificationChannelAsync(NAG_CHANNELS.firm, {
      name: 'Training, still ringing',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      enableVibrate: true,
      vibrationPattern: [0, 220, 120, 220],
      lightColor: '#A6431F',
    });
    await Notifications.setNotificationChannelAsync(NAG_CHANNELS.loud, {
      name: 'Training, last call',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      enableVibrate: true,
      vibrationPattern: [0, 400, 180, 400, 180, 400],
      lightColor: '#A6431F',
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** Never prompts. Lets a settings screen tell the truth about the queue. */
export async function notificationStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  if (current.canAskAgain) return 'undetermined';
  return 'denied';
}

/**
 * Cancels the whole queue and rebuilds it from the contract. Idempotent, cheap,
 * and it keeps the 64 slot iOS cap honest.
 */
export async function syncSchedule(state: AppState): Promise<number> {
  /**
   * Cancel first, always. Turning the alarms off has to empty a queue that is
   * already sitting in the system, and returning early before the cancel would
   * leave four weeks of reminders ringing after the switch was flipped.
   */
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!state.alarms) return 0;
  const contract = state.contract;
  if (!contract) return 0;

  const now = new Date();
  const specs = planNotifications({
    now,
    prefs: {
      anchorHour: contract.hour,
      anchorMinute: contract.minute,
      trainingDays: contract.days,
      reviewDay: 0,
      reviewHour: 18,
    },
    closedToday: state.entries.some(
      (entry) =>
        entry.day === todayKey(now) &&
        (entry.kind === 'full' ||
          entry.kind === 'floor' ||
          entry.kind === 'skip' ||
          entry.kind === 'skip-protected'),
    ),
    /** Anything written is evidence. Anything unwritten keeps its morning alarm. */
    writtenDays: state.entries.map((entry) => entry.day),
    trainedDays: state.entries
      .filter((entry) => entry.kind === 'full' || entry.kind === 'floor')
      .map((entry) => entry.day),
    skipDays: state.entries
      .filter((entry) => entry.kind === 'skip' || entry.kind === 'skip-protected')
      .map((entry) => entry.day),
    /** A gated day is quiet until the morning-after alarm. */
    gateDays: state.gates.map((gate) => gate.day),
    stake: contract.stake,
    since: contract.createdAt.slice(0, 10),
    brief: sessionBrief(state, now),
    repair: activeRepair(state, todayKey(now)),
    /**
     * Four weeks, not one. The app is meant to be installed and forgotten, so
     * the queue has to outlive the last time it was opened. Three training days
     * a week with an anchor, a fallback and a morning-after keeps the count
     * near forty pending, under the sixty that iOS tolerates.
     */
    horizonDays: 28,
    /**
     * Android has no practical cap here; iOS silently keeps the first 64 and
     * drops the rest. The ladder is what makes the queue tall, so the tall
     * version is Android only, and iOS keeps the shape it can actually hold.
     */
    maxPending: Platform.OS === 'android' ? 200 : 60,
  });

  let scheduled = 0;
  for (const spec of specs) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: spec.id,
        content: {
          title: spec.title,
          body: spec.body,
          data: spec.data,
          sound: true,
          /** setOngoing on Android: the nag cannot be swiped, only answered. */
          ...(spec.sticky ? { sticky: true } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: spec.at,
          channelId: Platform.OS === 'android' ? channelFor(spec) : undefined,
        },
      });
      scheduled += 1;
    } catch {
      // A platform that refuses one trigger should not empty the whole queue.
    }
  }
  return scheduled;
}

function channelFor(spec: Pick<NotificationSpec, 'kind' | 'intensity'>): string {
  if (spec.kind !== 'nag') return 'training';
  if (spec.intensity === 'firm') return NAG_CHANNELS.firm;
  if (spec.intensity === 'loud') return NAG_CHANNELS.loud;
  return NAG_CHANNELS.gentle;
}

/**
 * Five alerts, ten seconds apart, on the real channels and with the real copy.
 *
 * A ladder is a promise about a bad evening, and the only way to know it sounds
 * like one is to hear it while standing in the kitchen with the phone face down.
 * The identifiers carry today's day and the nag prefix on purpose: passing the
 * gate silences the test run the same way it silences the real one.
 */
export async function testLadder(): Promise<number> {
  const granted = await ensureNotificationPermission();
  if (!granted) return 0;
  const day = todayKey();
  const now = Date.now();
  let queued = 0;
  for (let index = 0; index < NAG_MINUTES.length; index += 1) {
    const [title, body] = NAG_COPY[index]!;
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `nag-${day}-test-${index}`,
        content: {
          title,
          body,
          data: { route: '/gate', kind: 'nag' },
          sound: true,
          sticky: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(now + (index + 1) * 10_000),
          channelId:
            Platform.OS === 'android'
              ? channelFor({ kind: 'nag', intensity: nagIntensity(index) })
              : undefined,
        },
      });
      queued += 1;
    } catch {
      // One refused trigger is not a reason to stop the other four.
    }
  }
  return queued;
}

/**
 * A sticky notification cannot be swiped, so cancelling the scheduled queue is
 * not enough once one has already landed: it would sit in the shade forever,
 * still ringing at a session that is already running. Dismissed is a separate
 * operation from cancelled, and the gate has to do both.
 */
export async function silenceLadder(day = todayKey()): Promise<number> {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  const scheduled = helpAlarmIds(
    pending.map((request) => request.identifier),
    day,
  );
  for (const identifier of scheduled) {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  }
  const presented = await Notifications.getPresentedNotificationsAsync();
  let dismissed = 0;
  for (const notification of presented) {
    const identifier = notification.request.identifier;
    if (!identifier.startsWith(`nag-${day}-`)) continue;
    await Notifications.dismissNotificationAsync(identifier);
    dismissed += 1;
  }
  return scheduled.length + dismissed;
}

/**
 * Stops today's help alarms the moment the first set is logged. The queue is
 * not rebuilt here on purpose: the session has not been written yet, so a
 * rebuild from state would put the same fallback straight back. Cancelling by
 * identifier touches only the two alarms that exist for an hour that has not
 * started.
 */
export async function cancelTodaysHelp(day = todayKey()): Promise<number> {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  const targets = helpAlarmIds(
    pending.map((request) => request.identifier),
    day,
  );
  for (const identifier of targets) {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  }
  return targets.length;
}

export async function pendingCount(): Promise<number> {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  return pending.length;
}

export const notificationHandler: Notifications.NotificationHandler = {
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
};
