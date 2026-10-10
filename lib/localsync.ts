import type { Session } from "./types";

/**
 * Offline-first session persistence. Every mutation is written to localStorage
 * synchronously (never lost, even if the tab dies mid-set) and the id is queued
 * in a dirty set. A PATCH to the server is attempted opportunistically; when it
 * fails (no signal) the local copy stays authoritative and the dirty entry
 * survives until `flushDirty` drains it — on the next `online` event or reload.
 *
 * Client-only: guards every localStorage touch so SSR imports are harmless.
 */

const key = (id: string) => `gym:s:${id}`;
const DIRTY_KEY = "gym:dirty";
const DONE_KEY = "gym:done";
// Enough to cover any plausible run of finishes between two server reads;
// the list is only ever read to contradict a stale render.
const DONE_CAP = 30;

function ls(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readLocal(id: string): Session | null {
  const store = ls();
  if (!store) return null;
  try {
    const raw = store.getItem(key(id));
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function readDirty(store: Storage): string[] {
  try {
    return JSON.parse(store.getItem(DIRTY_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

function writeDirty(store: Storage, ids: string[]): void {
  store.setItem(DIRTY_KEY, JSON.stringify([...new Set(ids)]));
}

function readDone(store: Storage): string[] {
  try {
    return JSON.parse(store.getItem(DONE_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

/** Save locally and mark dirty. Call on every mutation before the network try. */
export function writeLocal(session: Session): void {
  const store = ls();
  if (!store) return;
  store.setItem(key(session.id), JSON.stringify(session));
  writeDirty(store, [...readDirty(store), session.id]);
}

/**
 * Retire an outbox entry. `closed` frees the device copy too: a finished
 * session lives on the server now, and — more importantly — a local copy left
 * behind for a session the server considers closed is a ghost that would make
 * the overview offer "Resume" on a workout that is over.
 *
 * The id is kept as a tombstone. Dropping the copy also drops the only local
 * proof that the workout ended, and the overview needs that proof: a `/` render
 * captured before the finish (Next's client router cache, or the service worker
 * falling back offline) still names the session active, and with no local copy
 * to contradict it the banner offers to resume a workout that is over. That is
 * the finished-workout-came-back-as-Resume bug, one layer up.
 */
function markSynced(id: string, closed: boolean): void {
  const store = ls();
  if (!store) return;
  writeDirty(
    store,
    readDirty(store).filter((x) => x !== id),
  );
  if (!closed) return;
  store.removeItem(key(id));
  store.setItem(DONE_KEY, JSON.stringify([id, ...readDone(store).filter((x) => x !== id)].slice(0, DONE_CAP)));
}

/** Forget this device's copy of a session outright. */
export function dropLocal(id: string): void {
  markSynced(id, true);
}

/** An unsynced local write is still queued for this session. */
export function isDirty(id: string): boolean {
  const store = ls();
  return store ? readDirty(store).includes(id) : false;
}

/**
 * This device knows the session is over — either it still holds a finished copy
 * (finish written here, not yet synced) or it holds a tombstone (finish written
 * here and synced, copy freed). The overview must honour both: offering
 * "Resume" on a workout you finished, only because the render predates the
 * sync, is the offline face of the finished-workout-came-back-as-Resume bug.
 * Only a real finish records either mark, so this never over-reports.
 */
export function locallyFinished(id: string): boolean {
  const store = ls();
  if (!store) return false;
  return !!readLocal(id)?.finishedAt || readDone(store).includes(id);
}

/**
 * Finished sessions this device holds that the server has not acknowledged:
 * a workout finished without signal. Readiness counts them at once rather
 * than after the next sync.
 */
export function unsyncedFinished(): Session[] {
  const store = ls();
  if (!store) return [];
  return readDirty(store).flatMap((id) => {
    const local = readLocal(id);
    return local?.finishedAt ? [local] : [];
  });
}

/**
 * At most one in-flight PATCH per session, issued in call order. The server
 * keeps whole-blob last-write-wins, so two overlapping writes could land out
 * of order — a stale "unfinished" copy overtaking the finish write is exactly
 * how finished workouts came back as "Resume".
 */
const chains = new Map<string, Promise<unknown>>();

/**
 * PATCH jobs queued or in flight on this page. An app-update reload waits for
 * zero: a reload drops `chains`, but a keepalive PATCH already sent keeps going
 * and can land after the new page's flush, overwriting newer sets.
 */
let unsettled = 0;
const idleListeners = new Set<() => void>();

function enqueue<T>(id: string, job: () => Promise<T>): Promise<T> {
  unsettled++;
  const prev = chains.get(id) ?? Promise.resolve();
  const next = prev.then(job, job).finally(() => {
    unsettled--;
    if (unsettled === 0) for (const listener of idleListeners) listener();
  });
  chains.set(id, next);
  return next;
}

/** True while any session PATCH is queued or in flight on this page. */
export function patchesUnsettled(): boolean {
  return unsettled > 0;
}

/** Call `listener` each time the last queued or in-flight PATCH settles. */
export function onPatchesSettled(listener: () => void): () => void {
  idleListeners.add(listener);
  return () => idleListeners.delete(listener);
}

/**
 * What one PATCH attempt tells the outbox. `settled` means stop carrying this
 * write; `closed` means the server considers the session finished, so the device
 * copy can go. Closure comes from the server's response, not from what we sent:
 * the server keeps its own closure when an offline write tries to reopen a
 * session, and a device that ignored that would retry the same reopen forever.
 */
type Ack = { settled: boolean; closed: boolean };

async function patch(session: Session): Promise<Ack> {
  try {
    const res = await fetch(`/api/session/${session.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(session),
      // Survives the PWA being backgrounded mid-request — locking the phone
      // right after "Finish workout" must not lose the write.
      keepalive: true,
    });
    // 404: the record is gone from the server (deleted on purpose, or the store
    // was wiped). 400: this body will never be accepted. Retrying either pins
    // the outbox open for good, which leaves the sync badge stuck on "offline ·
    // will sync" and re-runs a doomed write on every page load. Let it go.
    if (res.status === 404 || res.status === 400) {
      console.warn(`[gym] server rejected session ${session.id} (${res.status}) — dropping local copy`);
      return { settled: true, closed: true };
    }
    // Anything else that failed (401 while the login cookie is being renewed,
    // 5xx, a captive-portal interception) is worth another try later.
    if (!res.ok) return { settled: false, closed: false };
    // Closed if either side says so. Our own finish counts because the server
    // accepted it; the server's answer counts because it keeps a closure our
    // queued write tried to undo, and a device that ignored that would retry
    // the same doomed reopen forever. Neither direction can be dropped.
    const stored = (await res.json().catch(() => null)) as Session | null;
    return { settled: true, closed: !!session.finishedAt || !!stored?.finishedAt };
  } catch {
    return { settled: false, closed: false };
  }
}

/** Save + try to sync one session. Returns true once the write is settled. */
export async function syncSession(session: Session): Promise<boolean> {
  writeLocal(session);
  const ack = await enqueue(session.id, () => patch(session));
  if (ack.settled) markSynced(session.id, ack.closed);
  return ack.settled;
}

/** Push every dirty session to the server. Called on load and on reconnect. */
export async function flushDirty(): Promise<void> {
  const store = ls();
  if (!store) return;
  for (const id of readDirty(store)) {
    const session = readLocal(id);
    if (!session) {
      markSynced(id, true);
      continue;
    }
    const ack = await enqueue(id, () => patch(session));
    if (ack.settled) markSynced(id, ack.closed);
  }
}

export function hasPending(): boolean {
  const store = ls();
  return store ? readDirty(store).length > 0 : false;
}
