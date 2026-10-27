import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { appendEvent, loadEvents } from '../db/events';
import { todayKey } from '../domain/consistency';
import { reduceEvents, type AppEvent, type AppState, type Contract } from '../domain/state';
import type { Equipment, SessionKey, SetResult } from '../domain/types';
import { ensureNotificationPermission, syncSchedule } from '../services/notifications';

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
  refresh: () => Promise<void>;
}

interface Store {
  state: AppState;
  ready: boolean;
  error: string | null;
  actions: Actions;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => reduceEvents([]));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const commit = useCallback(async (event: Omit<AppEvent, 'id'>): Promise<AppState> => {
    await appendEvent(event);
    const events = await loadEvents();
    const next = reduceEvents(events);
    if (mounted.current) setState(next);
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
    return next;
  }, []);

  const refresh = useCallback(async () => {
    const events = await loadEvents();
    if (mounted.current) setState(reduceEvents(events));
  }, []);

  useEffect(() => {
    mounted.current = true;
    (async () => {
      try {
        const events = await loadEvents();
        const initial = reduceEvents(events);
        if (mounted.current) setState(initial);
        setReady(true);
        /**
         * The queue is planned forward from the day it is rebuilt, so a week of
         * not opening the app would leave the last days silent. Opening the app
         * is the cheapest moment to extend it, and it costs nothing to repeat.
         */
        if (initial.contract) void syncSchedule(initial).catch(() => 0);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'The ledger could not be opened.');
        setReady(true);
      }
    })();
    return () => {
      mounted.current = false;
    };
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

  const value = useMemo<Store>(() => ({ state, ready, error, actions }), [state, ready, error, actions]);

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
