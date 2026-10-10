import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  dropLocal,
  flushDirty,
  hasPending,
  isDirty,
  locallyFinished,
  readLocal,
  syncSession,
  writeLocal,
} from "../lib/localsync";
import type { Session } from "../lib/types";

function makeSession(over: Partial<Session> = {}): Session {
  return {
    id: "2026-08-04T10-00-00-000Z",
    dayId: "day-a",
    dayName: "Day A",
    startedAt: "2026-08-04T10:00:00.000Z",
    finishedAt: null,
    sessionFeel: null,
    exercises: [],
    ...over,
  };
}

const ok = () => new Response("{}", { status: 200 });
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// The outbox chains PATCHes on promises, never on timers, so draining the
// microtask queue is enough to see exactly what has been dispatched — no
// wall-clock wait, nothing to race under load.
async function settle() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("syncSession", () => {
  it("sends PATCHes with keepalive so backgrounding cannot kill a finish write", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(ok());
    vi.stubGlobal("fetch", fetchMock);
    await syncSession(makeSession({ finishedAt: "2026-08-04T11:00:00.000Z" }));
    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.keepalive).toBe(true);
    expect(init.method).toBe("PATCH");
  });

  it("serializes PATCHes per session: the finish write never races an older write", async () => {
    const first = Promise.withResolvers<Response>();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(ok());
    vi.stubGlobal("fetch", fetchMock);

    const unfinished = makeSession();
    const finished = makeSession({ finishedAt: "2026-08-04T11:00:00.000Z" });

    const p1 = syncSession(unfinished);
    const p2 = syncSession(finished);
    await settle();

    // Second PATCH must NOT be issued while the first is in flight.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    first.resolve(ok());
    await p1;
    await p2;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const bodies = fetchMock.mock.calls.map(
      (c) => JSON.parse((c[1] as RequestInit).body as string) as Session,
    );
    expect(bodies[0].finishedAt).toBeNull();
    expect(bodies[1].finishedAt).toBe("2026-08-04T11:00:00.000Z");
  });

  it("keeps a failed write dirty and local so it can be retried", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    const s = makeSession({ finishedAt: "2026-08-04T11:00:00.000Z" });
    expect(await syncSession(s)).toBe(false);
    expect(hasPending()).toBe(true);
    expect(readLocal(s.id)?.finishedAt).toBe("2026-08-04T11:00:00.000Z");
  });

  it("clears the device copy once a finished session reaches the server", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ok()));
    const s = makeSession({ finishedAt: "2026-08-04T11:00:00.000Z" });
    expect(await syncSession(s)).toBe(true);
    expect(hasPending()).toBe(false);
    expect(readLocal(s.id)).toBeNull();
  });

  /**
   * The device copy is freed on close, and it used to be the only local record
   * that the workout ended. A `/` render captured before the finish — Next's
   * client router cache, or the service worker answering offline — then had
   * nothing to contradict it, and the overview offered "Resume" on a workout
   * that was over. The tombstone is what contradicts it.
   */
  it("remembers the finish after the device copy is freed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ok()));
    const s = makeSession({ finishedAt: "2026-08-04T11:00:00.000Z" });

    await syncSession(s);

    expect(readLocal(s.id)).toBeNull();
    expect(locallyFinished(s.id)).toBe(true);
  });
});

describe("flushDirty", () => {
  it("pushes a dirty finished session and clears it", async () => {
    const s = makeSession({ finishedAt: "2026-08-04T11:00:00.000Z" });
    writeLocal(s); // dirty, unsynced — the "lost finish" state
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal("fetch", fetchMock);

    await flushDirty();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(hasPending()).toBe(false);
    expect(readLocal(s.id)).toBeNull();
  });
});

describe("outbox failure handling", () => {
  it("keeps retrying a 5xx: a server wobble must not lose a workout", async () => {
    const s = makeSession({ finishedAt: "2026-08-04T11:00:00.000Z" });
    writeLocal(s);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 503 })));

    await flushDirty();

    expect(isDirty(s.id)).toBe(true);
    expect(readLocal(s.id)?.finishedAt).toBe("2026-08-04T11:00:00.000Z");
  });

  it("keeps retrying a 401: an expired login must not discard the write", async () => {
    const s = makeSession();
    writeLocal(s);
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "unauthorized" }, 401)));

    await flushDirty();

    expect(isDirty(s.id)).toBe(true);
  });

  it("drops a write the server can never accept (404), instead of retrying forever", async () => {
    // The session's record is gone — deleted on purpose, or the store was
    // wiped. Left in the outbox it would re-run on every page load and pin the
    // sync badge to "offline · will sync" for good.
    const s = makeSession();
    writeLocal(s);
    const fetchMock = vi.fn(async () => json({ error: "not found" }, 404));
    vi.stubGlobal("fetch", fetchMock);

    await flushDirty();

    expect(hasPending()).toBe(false);
    expect(readLocal(s.id)).toBeNull();

    await flushDirty();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("frees the device copy when the server answers that the session is closed", async () => {
    // The abandon reaper closed this session while the phone was offline. The
    // queued write delivers its sets; the server keeps the closure and says so.
    // Honouring that is what stops the device re-sending the same reopen.
    const s = makeSession();
    writeLocal(s);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ ...s, finishedAt: "2026-08-04T12:00:00.000Z", autoClosed: true })),
    );

    await flushDirty();

    expect(hasPending()).toBe(false);
    expect(readLocal(s.id)).toBeNull();
  });

  it("keeps an unfinished session's copy when the server agrees it is open", async () => {
    // Paused, synced, still resumable: the local copy stays as the offline
    // source of truth for the next resume.
    const s = makeSession({ pausedAt: "2026-08-04T11:30:00.000Z" });
    vi.stubGlobal("fetch", vi.fn(async () => json(s)));

    expect(await syncSession(s)).toBe(true);

    expect(hasPending()).toBe(false);
    expect(readLocal(s.id)?.pausedAt).toBe("2026-08-04T11:30:00.000Z");
  });
});

describe("locallyFinished", () => {
  it("reports a finish this device holds but has not delivered", async () => {
    const s = makeSession({ finishedAt: "2026-08-04T11:00:00.000Z" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await syncSession(s);

    // This is what stops the overview offering "Resume" on a workout finished
    // in a dead zone, and DayCard labelling the day "Resume →".
    expect(locallyFinished(s.id)).toBe(true);
  });

  it("is false for an open session and for one it knows nothing about", () => {
    const s = makeSession({ pausedAt: "2026-08-04T11:30:00.000Z" });
    writeLocal(s);
    expect(locallyFinished(s.id)).toBe(false);
    expect(locallyFinished("no-such-session")).toBe(false);
  });

  it("dropLocal forgets a superseded copy, outbox entry included", () => {
    const s = makeSession();
    writeLocal(s);
    dropLocal(s.id);
    expect(readLocal(s.id)).toBeNull();
    expect(isDirty(s.id)).toBe(false);
  });
});
