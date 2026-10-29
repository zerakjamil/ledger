import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState as DeviceState } from 'react-native';
import { appendEvent, loadEvents } from '../db/events';
import { todayKey } from '../domain/consistency';
import { reduceEvents, type AppEvent, type AppState, type Contract } from '../domain/state';
import type { GateGrade, GateScores } from '../domain/gate';
import type { Equipment, SessionKey, SetResult } from '../domain/types';
import { ensureNotificationPermission, silenceLadder, syncSchedule } from '../services/notifications';
import { syncWidget } from '../widget/sync';

interface Actions {
  signContract: (contract: Omit<Contract, 'createdAt'>) => Promise<void>;
  updateSchedule: (days: number[], hour: number, minute: number) => Promise<number>;
  saveEquipment: (equipment: Equipment) => Promise<void>;
  logWeight: (kg: number) => Promise<void>;
  logWaist: (cm: number) => Promise<void>;
  logSteps: (ok: boolean) => Promise<void>;
  skipToday: (
    reason: string,
    useToken: boolean,
    repair?: { day: string; hour: number; minute: number },
  ) => Promise<void>;
  cancelRepair: () => Promise<void>;
  finishSession: (
    key: SessionKey,
    kind: 'full' | 'floor',
    startedAt: Date,
    results: Record<string, SetResult[]>,
  ) => Promise<void>;
  /** Put a shelf movement in a program slot, or the original back. */
  setSlot: (slot: string, movementId: string) => Promise<void>;
  /** Silence or restore the appointment alarms. Returns the new queue length. */
  setAlarms: (on: boolean) => Promise<number>;
  /**
   * The photo was taken and the gate opened. This is written before the first
   * set, not after, because its job is to stop the phone ringing at a session
   * that has already started.
   */
  passGate: (grade: GateGrade, photo: string | null, scores: GateScores | null) => Promise<void>;
  refresh: () => Promise<void>;
}

interface Store {
  state: AppState;
  ready: boolean;
  error: string | null;
  actions: Actions;
  /**
   * Bumped when the notification queue has been rebuilt. The settings screen
   * reads the queue from the system, and that read has to happen after the
   * write: on a cold start the first read would otherwise find the queue the
   * old process left behind, or none at all, and call it zero.
   */
  queueVersion: number;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => reduceEvents([]));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queueVersion, setQueueVersion] = useState(0);
  const mounted = useRef(true);

  const commit = useCallback(async (event: Omit<AppEvent, 'id'>): Promise<AppState> => {
    await appendEvent(event);
    const events = await loadEvents();
    const next = reduceEvents(events);
    if (mounted.current) setState(next);
    void syncWidget(next);
    return next;
  }, []);

  /**
   * One decision can write two lines: a skip and the repair it booked. They are
   * appended before the state is rebuilt once, so the page never renders a skip
   * that has lost its plan in the gap between two writes.
   */
  const commitMany = useCallback(async (events: Omit<AppEvent, 'id'>[]): Promise<AppState> => {
    for (const event of events) await appendEvent(event);
    const all = await loadEvents();
    const next = reduceEvents(all);
    if (mounted.current) setState(next);
    void syncWidget(next);
    return next;
  }, []);

  const refresh = useCallback(async () => {
    const events = await loadEvents();
    const next = reduceEvents(events);
    if (mounted.current) setState(next);
    void syncWidget(next);
  }, []);

  useEffect(() => {
    mounted.current = true;
    (async () => {
      try {
        const events = await loadEvents();
        const initial = reduceEvents(events);
        if (mounted.current) setState(initial);
        setReady(true);
        void syncWidget(initial);
        /**
         * The queue is planned forward from the day it is rebuilt, so a week of
         * not opening the app would leave the last days silent. Opening the app
         * is the cheapest moment to extend it, and it costs nothing to repeat.
         */
        if (initial.contract) {
          void syncSchedule(initial)
            .catch(() => 0)
            .then(() => {
              if (mounted.current) setQueueVersion((value) => value + 1);
            });
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'The ledger could not be opened.');
        setReady(true);
      }
    })();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  /**
   * A widget is only as honest as the last time it was rendered. Every return
   * to the foreground re-reads the ledger, so a phone left open across midnight
   * does not keep yesterday's page or last week's count on the home screen.
   */
  useEffect(() => {
    const sub = DeviceState.addEventListener('change', (status) => {
      if (status === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const actions = useMemo<Actions>(
    () => ({
      signContract: async (contract) => {
        const next = await commit(
          makeEvent('contract.set', { ...contract, createdAt: new Date().toISOString() }),
        );
        await ensureNotificationPermission().catch(() => false);
        await syncSchedule(next).catch(() => 0);
      },
      updateSchedule: async (days, hour, minute) => {
        const current = state.contract;
        if (!current) return 0;
        const next = await commit(makeEvent('contract.set', { ...current, days, hour, minute }));
        await ensureNotificationPermission().catch(() => false);
        return syncSchedule(next).catch(() => 0);
      },
      saveEquipment: async (equipment) => {
        await commit(makeEvent('equipment.set', equipment as unknown as Record<string, unknown>));
      },
      logWeight: async (kg) => {
        await commit(makeEvent('weigh', { kg }));
      },
      logWaist: async (cm) => {
        await commit(makeEvent('waist', { cm }));
      },
      logSteps: async (ok) => {
        await commit(makeEvent('steps', { ok }));
      },
      skipToday: async (reason, useToken, repair) => {
        const events: Omit<AppEvent, 'id'>[] = [
          makeEvent('skip', { reason, protected: useToken }),
        ];
        if (repair) events.push(makeEvent('repair.book', { ...repair }));
        const next = await commitMany(events);
        void syncSchedule(next).catch(() => undefined);
      },
      cancelRepair: async () => {
        const next = await commit(makeEvent('repair.cancel', {}));
        void syncSchedule(next).catch(() => undefined);
      },
      setSlot: async (slot, movementId) => {
        const next = await commit(makeEvent('slot.set', { slot, movementId }));
        /** The lock-screen brief names the first movement, so it is now stale. */
        void syncSchedule(next).catch(() => undefined);
      },
      passGate: async (grade, photo, scores) => {
        const next = await commit(makeEvent('gate.pass', { grade, photo, scores }));
        /** A sticky nag cannot be swiped, so it has to be dismissed as well as cancelled. */
        await silenceLadder(todayKey()).catch(() => 0);
        void syncSchedule(next).catch(() => undefined);
      },
      setAlarms: async (on) => {
        const next = await commit(makeEvent('setting.set', { alarms: on }));
        return syncSchedule(next).catch(() => 0);
      },
      finishSession: async (key, kind, startedAt, results) => {
        const event = makeEvent('session.finish', {
          key,
          kind,
          startedAt: startedAt.toISOString(),
          results,
        });
        const next = await commit(event);
        void syncSchedule(next).catch(() => undefined);
      },
      refresh,
    }),
    [commit, commitMany, refresh, state.contract],
  );

  const value = useMemo<Store>(
    () => ({ state, ready, error, actions, queueVersion }),
    [state, ready, error, actions, queueVersion],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const store = useContext(Ctx);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}

function makeEvent(type: AppEvent['type'], payload: Record<string, unknown>): Omit<AppEvent, 'id'> {
  const at = new Date();
  return { at: at.toISOString(), day: todayKey(at), type, payload };
}
