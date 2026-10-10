import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { Session } from "../lib/types";

// BUILD_ID is read when lib/appupdate.ts loads, so each test imports a fresh
// copy (with a fresh localsync) after stubbing the environment.
async function load(buildId = "build-a") {
  vi.resetModules();
  vi.stubEnv("GYM_BUILD_ID", buildId);
  const update = await import("../lib/appupdate");
  const localsync = await import("../lib/localsync");
  return { ...update, ...localsync };
}

const version = (buildId: string) =>
  new Response(JSON.stringify({ buildId }), { status: 200, headers: { "content-type": "application/json" } });

const session: Session = {
  id: "2026-10-08T10-00-00-000Z",
  dayId: "day-a",
  dayName: "Day A",
  startedAt: "2026-10-08T10:00:00.000Z",
  finishedAt: null,
  sessionFeel: null,
  exercises: [],
};

let reload: Mock<() => void>;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  reload = vi.fn();
  vi.stubGlobal("location", { pathname: "/", reload });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("canApplyUpdate", () => {
  it("never applies inside a session", async () => {
    const { canApplyUpdate } = await load();
    expect(canApplyUpdate("/session/2026-10-08T10-00-00-000Z", 0, false)).toBe(false);
    expect(canApplyUpdate("/", 0, false)).toBe(true);
    expect(canApplyUpdate("/login", 0, false)).toBe(true);
  });

  it("waits while the overview is busy or a PATCH is unsettled", async () => {
    const { canApplyUpdate } = await load();
    expect(canApplyUpdate("/", 1, false)).toBe(false);
    expect(canApplyUpdate("/", 0, true)).toBe(false);
  });
});

describe("checkForUpdate", () => {
  it("reloads the idle overview when the server runs a newer build", async () => {
    const { checkForUpdate } = await load();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(version("build-b")));
    await checkForUpdate();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("does nothing when the build matches", async () => {
    const { checkForUpdate } = await load();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(version("build-a")));
    await checkForUpdate();
    expect(reload).not.toHaveBeenCalled();
  });

  it("does not check while offline", async () => {
    const { checkForUpdate } = await load();
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await checkForUpdate();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("ignores a failed or empty answer", async () => {
    const { checkForUpdate } = await load();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 401 })));
    await checkForUpdate();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(version("")));
    await checkForUpdate();
    expect(reload).not.toHaveBeenCalled();
  });

  it("keeps the update pending inside a session and applies it after leaving", async () => {
    const { checkForUpdate, applyPendingUpdate } = await load();
    vi.stubGlobal("location", { pathname: "/session/x", reload });
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(version("build-b")));
    await checkForUpdate();
    expect(reload).not.toHaveBeenCalled();
    vi.stubGlobal("location", { pathname: "/", reload });
    applyPendingUpdate();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("waits for an overview hold and applies when the last one is released", async () => {
    const { checkForUpdate, holdUpdate } = await load();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(version("build-b")));
    const releaseA = holdUpdate();
    const releaseB = holdUpdate();
    await checkForUpdate();
    releaseA();
    releaseA();
    vi.runAllTimers();
    expect(reload).not.toHaveBeenCalled();
    releaseB();
    vi.runAllTimers();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("waits while a session PATCH is in flight", async () => {
    const { checkForUpdate, applyPendingUpdate, syncSession, patchesUnsettled } = await load();
    const inFlight = Promise.withResolvers<Response>();
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockImplementation((url) => (String(url).startsWith("/api/session") ? inFlight.promise : Promise.resolve(version("build-b")))),
    );
    const write = syncSession(session);
    expect(patchesUnsettled()).toBe(true);
    await checkForUpdate();
    expect(reload).not.toHaveBeenCalled();
    inFlight.resolve(new Response("{}", { status: 200 }));
    await write;
    expect(patchesUnsettled()).toBe(false);
    applyPendingUpdate();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("tries a reload only once per remote build", async () => {
    const { checkForUpdate } = await load();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(version("build-b")));
    await checkForUpdate();
    await checkForUpdate();
    expect(reload).toHaveBeenCalledOnce();
  });
});
