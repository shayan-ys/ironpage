import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SyncOnLoad } from "../components/SyncOnLoad";
import { hasPending, writeLocal } from "../lib/localsync";
import type { Session } from "../lib/types";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

// Tells React this test drives updates through act().
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);

const finished: Session = {
  id: "2026-10-07T22-00-00-000Z",
  dayId: "day-c",
  dayName: "Day C",
  startedAt: "2026-10-07T22:00:00.000Z",
  finishedAt: "2026-10-08T00:00:00.000Z",
  sessionFeel: "strong",
  exercises: [],
};

let root: Root;
let visibility: DocumentVisibilityState;

async function settle() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

beforeEach(() => {
  localStorage.clear();
  refresh.mockClear();
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
  root = createRoot(document.createElement("div"));
});

afterEach(() => {
  act(() => root.unmount());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("SyncOnLoad", () => {
  it("drains a finish that failed before backgrounding when the app returns to the foreground", async () => {
    // The finish was written locally; its PATCH failed as the phone locked.
    writeLocal(finished);
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Load failed"));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("location", { pathname: `/session/${finished.id}` });
    await act(async () => {
      root.render(createElement(SyncOnLoad));
      await settle();
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(hasPending()).toBe(true);

    // iOS resumes the suspended PWA: no reload and no `online` event, only visibility.
    fetchMock.mockClear();
    fetchMock.mockResolvedValue(new Response(JSON.stringify(finished), { status: 200 }));
    visibility = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    visibility = "visible";
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await settle();
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`/api/session/${finished.id}`);
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body)).finishedAt).toBe(finished.finishedAt);
    expect(hasPending()).toBe(false);
    // The session page is never refreshed (an app update must not reload it).
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes the overview after a foreground drain", async () => {
    vi.stubGlobal("location", { pathname: "/" });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(finished), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => {
      root.render(createElement(SyncOnLoad));
      await settle();
    });
    expect(fetchMock).not.toHaveBeenCalled();

    writeLocal(finished);
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await settle();
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(hasPending()).toBe(false);
    expect(refresh).toHaveBeenCalledOnce();
  });
});
