import * as SQLite from 'expo-sqlite';
import type { AppEvent } from '../domain/state';

let handle: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (handle) return handle;
  const db = await SQLite.openDatabaseAsync('ledger.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL,
      day TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS events_at ON events (at);
  `);
  handle = db;
  return db;
}

export async function loadEvents(): Promise<AppEvent[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: number;
    at: string;
    day: string;
    type: string;
    payload: string;
  }>('SELECT id, at, day, type, payload FROM events ORDER BY at ASC, id ASC');

  return rows.map((row) => ({
    id: row.id,
    at: row.at,
    day: row.day,
    type: row.type as AppEvent['type'],
    payload: safeParse(row.payload),
  }));
}

export async function appendEvent(event: Omit<AppEvent, 'id'>): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO events (at, day, type, payload) VALUES (?, ?, ?, ?)',
    event.at,
    event.day,
    event.type,
    JSON.stringify(event.payload),
  );
}

export async function exportLog(): Promise<string> {
  const events = await loadEvents();
  return JSON.stringify(
    {
      app: 'ledger',
      exportedAt: new Date().toISOString(),
      eventCount: events.length,
      events,
    },
    null,
    2,
  );
}

export async function countEvents(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM events');
  return row?.n ?? 0;
}

function safeParse(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
