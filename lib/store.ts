import "server-only";
import { readFile, readdir, writeFile, mkdir, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { put, head, get, list, del, BlobNotFoundError } from "@vercel/blob";
import type { Program, Session } from "./types";
import { reapAbandoned } from "./defaults";
import { withStoredMuscleImpact } from "./muscles";

/**
 * Storage adapter.
 * - Vercel Blob JSON files when `BLOB_READ_WRITE_TOKEN` or `BLOB_STORE_ID`
 *   (Vercel OIDC connections) is set. `BLOB_ACCESS` picks the store's access
 *   mode: `private` (the default, and what new Vercel stores use) or `public`.
 * - Otherwise the filesystem under .data/.
 * Same interface either way, so scripts see the same data shape.
 *
 * Reads throw on anything but a real not-found. Returning null for a network
 * or auth error would look like an empty store and invite a later write over
 * real data.
 */

const PROGRAM_KEY = "program.json";
const sessionKey = (id: string) => `sessions/${id}.json`;
const hasBlobBackend = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const blobAccess = (): "public" | "private" => (process.env.BLOB_ACCESS === "public" ? "public" : "private");

const DATA_ROOT = join(process.cwd(), ".data");

/* ------------------------- Vercel Blob backend ------------------------- */

async function blobPutJSON(key: string, data: unknown): Promise<void> {
  await put(key, JSON.stringify(data, null, 2), {
    access: blobAccess(),
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    // These are mutable JSON docs, overwritten in place. Without this the CDN
    // caches the URL for ~a year and reads go stale after every write.
    cacheControlMaxAge: 0,
  });
}

/** One blob's JSON by pathname (private) or URL; null only when the blob does not exist. */
async function blobFetchJSON<T>(urlOrPathname: string): Promise<T | null> {
  if (blobAccess() === "private") {
    // `useCache: false` reads origin storage, so a write is visible at once.
    const res = await get(urlOrPathname, { access: "private", useCache: false });
    if (!res) return null;
    if (res.statusCode !== 200) throw new Error(`blob read ${urlOrPathname}: status ${res.statusCode}`);
    return (await new Response(res.stream).json()) as T;
  }
  // Public blob URLs are edge-cached; a per-read cache-buster forces the
  // freshest version so a write is immediately visible on the next read.
  const busted = `${urlOrPathname}${urlOrPathname.includes("?") ? "&" : "?"}_=${Date.now()}`;
  const res = await fetch(busted, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`blob read ${urlOrPathname}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function blobGetJSON<T>(key: string): Promise<T | null> {
  if (blobAccess() === "private") return blobFetchJSON<T>(key);
  let url: string;
  try {
    url = (await head(key)).url;
  } catch (err) {
    if (err instanceof BlobNotFoundError) return null;
    throw err;
  }
  return blobFetchJSON<T>(url);
}

// The blobs are fetched in parallel: one at a time, every page load paid a
// round trip per session ever logged, and that grows with every workout.
async function blobListSessions(): Promise<Session[]> {
  const out: Session[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: "sessions/", cursor });
    const docs = await Promise.all(page.blobs.map((b) => blobFetchJSON<Session>(b.url)));
    for (const doc of docs) if (doc) out.push(doc);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

/* ------------------------- Local filesystem backend ------------------------- */

async function fsPutJSON(key: string, data: unknown): Promise<void> {
  const file = join(DATA_ROOT, key);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

async function fsGetJSON<T>(key: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(join(DATA_ROOT, key), "utf8")) as T;
  } catch (err) {
    // Only a missing file means "not stored"; a corrupt file must surface.
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function fsListSessions(): Promise<Session[]> {
  const dir = join(DATA_ROOT, "sessions");
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }
  const out: Session[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    out.push(JSON.parse(await readFile(join(dir, f), "utf8")) as Session);
  }
  return out;
}

/* ------------------------- Public API ------------------------- */

/**
 * The live plan, or null when none has been stored yet. Nothing is seeded:
 * the overview shows the starter picker until a program is stored through
 * `PUT /api/program`.
 */
export async function getProgram(): Promise<Program | null> {
  return hasBlobBackend() ? blobGetJSON<Program>(PROGRAM_KEY) : fsGetJSON<Program>(PROGRAM_KEY);
}

export async function putProgram(program: Program): Promise<void> {
  if (hasBlobBackend()) await blobPutJSON(PROGRAM_KEY, program);
  else await fsPutJSON(PROGRAM_KEY, program);
}

export async function getSession(id: string): Promise<Session | null> {
  return hasBlobBackend()
    ? blobGetJSON<Session>(sessionKey(id))
    : fsGetJSON<Session>(sessionKey(id));
}

/** Every session write goes through here, so a finished session's stored `muscleImpact` always matches its log. */
export async function putSession(session: Session): Promise<void> {
  const stored = withStoredMuscleImpact(session);
  if (hasBlobBackend()) await blobPutJSON(sessionKey(stored.id), stored);
  else await fsPutJSON(sessionKey(stored.id), stored);
}

export async function deleteSession(id: string): Promise<void> {
  if (hasBlobBackend()) {
    const meta = await head(sessionKey(id));
    await del(meta.url);
  } else {
    await rm(join(DATA_ROOT, sessionKey(id)), { force: true });
  }
}

export async function listSessions(): Promise<Session[]> {
  const all = hasBlobBackend() ? await blobListSessions() : await fsListSessions();
  return all.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/**
 * Every session, plus the one you are in the middle of — from a single listing,
 * so both agree.
 *
 * Reading retires abandoned sessions as a side effect: an open session nobody
 * has touched for `ABANDON_AFTER_MS` is closed at its last activity and handed
 * back closed. That is what makes "pause" safe to offer — a paused workout you
 * never came back to ends itself instead of greeting you with "Resume" a
 * fortnight later, and the next start of that day is a fresh record. Doing it
 * on read rather than on a schedule keeps it to one chokepoint, and it sweeps
 * up any older open sessions hiding behind the newest one.
 *
 * The returned list carries the retired copies, not the stale ones: deriving
 * "last done" from a pre-reap listing would leave the overview claiming a day
 * was never trained until the next page load.
 */
export async function getOverview(): Promise<{ active: Session | null; sessions: Session[] }> {
  const all = await listSessions();
  const retire = reapAbandoned(all);
  if (retire.length > 0) await Promise.all(retire.map(putSession));
  const retired = new Map(retire.map((s) => [s.id, s]));
  const sessions = retired.size > 0 ? all.map((s) => retired.get(s.id) ?? s) : all;
  return { active: sessions.find((s) => s.finishedAt === null) ?? null, sessions };
}
