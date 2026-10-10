import type { Program, Session } from "../types";
import { reapAbandoned } from "../defaults";
import { withStoredMuscleImpact } from "../muscles";
import { seedDemo } from "./seed";

/**
 * The demo's stand-in for `lib/store.ts`: the same operations over one JSON
 * document in this browser's localStorage, so the demo needs no server. It
 * plays the server's part only; the app's own device copy and outbox
 * (`lib/localsync.ts`) still run on top of it through the `/api` shim
 * (`lib/demo/api.ts`), exactly as they do against the real server.
 *
 * Keep the write rules in step with `lib/store.ts`: every session write
 * recomputes `muscleImpact`, and reading the overview retires abandoned
 * sessions.
 */

/** Every key the app writes starts with this; Reset clears them all. */
const APP_PREFIX = "gym:";
const DB_KEY = "gym:demo:db";

interface DemoDb {
  program: Program | null;
  sessions: Record<string, Session>;
}

const listeners = new Set<() => void>();

function read(): DemoDb {
  const raw = localStorage.getItem(DB_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as DemoDb;
    } catch {
      // A corrupt document is replaced by a fresh seed below.
    }
  }
  const db = seed();
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  return db;
}

function write(db: DemoDb): void {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  for (const listener of listeners) listener();
}

function seed(): DemoDb {
  const { program, sessions } = seedDemo(new Date());
  return {
    program,
    sessions: Object.fromEntries(sessions.map((s) => [s.id, withStoredMuscleImpact(s)])),
  };
}

/** Call `listener` after every write; returns the unsubscribe. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function getProgram(): Promise<Program | null> {
  return read().program;
}

export async function putProgram(program: Program): Promise<void> {
  write({ ...read(), program });
}

export async function getSession(id: string): Promise<Session | null> {
  return read().sessions[id] ?? null;
}

export async function putSession(session: Session): Promise<void> {
  const db = read();
  write({ ...db, sessions: { ...db.sessions, [session.id]: withStoredMuscleImpact(session) } });
}

export async function deleteSession(id: string): Promise<void> {
  const db = read();
  const sessions = { ...db.sessions };
  delete sessions[id];
  write({ ...db, sessions });
}

export async function listSessions(): Promise<Session[]> {
  return Object.values(read().sessions).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/** Same contract as `getOverview` in `lib/store.ts`, including the reap on read. */
export async function getOverview(): Promise<{ active: Session | null; sessions: Session[] }> {
  const all = await listSessions();
  const retire = reapAbandoned(all);
  for (const s of retire) await putSession(s);
  const retired = new Map(retire.map((s) => [s.id, s]));
  const sessions = retired.size > 0 ? all.map((s) => retired.get(s.id) ?? s) : all;
  return { active: sessions.find((s) => s.finishedAt === null) ?? null, sessions };
}

/**
 * Back to the seed: drops the demo store and everything else the app keeps in
 * this browser (device copies, outbox, rest skips, settings), so no stale
 * local copy can outlive the data it belonged to.
 */
export function resetDemo(): void {
  for (const storage of [localStorage, sessionStorage]) {
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i));
    for (const key of keys) if (key?.startsWith(APP_PREFIX)) storage.removeItem(key);
  }
  write(seed());
}
