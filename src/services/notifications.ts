import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { planNotifications } from '../domain/notifications';
import type { AppState } from '../domain/state';
import { todayKey } from '../domain/consistency';
import { sessionBrief } from '../domain/brief';
import { activeRepair } from '../domain/repair';

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
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: spec.at,
          channelId: Platform.OS === 'android' ? 'training' : undefined,
        },
      });
      scheduled += 1;
    } catch {
      // A platform that refuses one trigger should not empty the whole queue.
    }
  }
  return scheduled;
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
