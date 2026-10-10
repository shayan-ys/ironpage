import { describe, expect, it } from "vitest";
import type { LoggedSet, Session } from "../lib/types";
import { canStartHold, holdLabel } from "../lib/hold";
import { alarmIsLive, STALE_ALARM_MS } from "../lib/alarm";

function set(options: Partial<LoggedSet> = {}): LoggedSet {
  return { weightLb: 0, reps: 25, rpe: null, done: false, skipped: false, ...options };
}

function session(sets: LoggedSet[], options: { timed?: boolean; finishedAt?: string | null } = {}): Session {
  return {
    id: "session/1",
    dayId: "day-a",
    dayName: "Day A",
    startedAt: "2026-10-09T10:00:00.000Z",
    finishedAt: options.finishedAt ?? null,
    sessionFeel: null,
    exercises: [
      {
        exerciseId: "plank",
        name: "Plank",
        skipped: false,
        ...(options.timed === false ? {} : { timed: true }),
        sets,
      },
    ],
  };
}

describe("canStartHold", () => {
  it("offers the first open working row of a timed exercise", () => {
    expect(canStartHold(session([set(), set()]), 0, 0)).toBe(true);
  });

  it("follows the set-order rule for later working rows", () => {
    expect(canStartHold(session([set(), set()]), 0, 1)).toBe(false);
    expect(canStartHold(session([set({ done: true }), set()]), 0, 1)).toBe(true);
  });

  it("offers ramp rows in any order", () => {
    expect(canStartHold(session([set({ warmup: true }), set({ warmup: true }), set()]), 0, 1)).toBe(true);
  });

  it("refuses done, skipped and zero-length rows", () => {
    expect(canStartHold(session([set({ done: true })]), 0, 0)).toBe(false);
    expect(canStartHold(session([set({ skipped: true })]), 0, 0)).toBe(false);
    expect(canStartHold(session([set({ reps: 0 })]), 0, 0)).toBe(false);
  });

  it("refuses untimed exercises and finished sessions", () => {
    expect(canStartHold(session([set()], { timed: false }), 0, 0)).toBe(false);
    expect(canStartHold(session([set()], { finishedAt: "2026-10-09T11:00:00.000Z" }), 0, 0)).toBe(false);
  });
});

describe("holdLabel", () => {
  it("shows whole seconds rounded up below a minute", () => {
    expect(holdLabel(25000)).toBe("25");
    expect(holdLabel(24001)).toBe("25");
    expect(holdLabel(999)).toBe("1");
    expect(holdLabel(0)).toBe("0");
    expect(holdLabel(-500)).toBe("0");
  });

  it("switches to m:ss from one minute", () => {
    expect(holdLabel(59001)).toBe("1:00");
    expect(holdLabel(90000)).toBe("1:30");
  });
});

describe("alarmIsLive", () => {
  const endsAt = 1_000_000;

  it("sounds when delivered on time to a visible page", () => {
    expect(alarmIsLive(endsAt, endsAt, true, false)).toBe(true);
    expect(alarmIsLive(endsAt, endsAt + STALE_ALARM_MS, true, false)).toBe(true);
  });

  it("stays silent when hidden, hidden since, or late", () => {
    expect(alarmIsLive(endsAt, endsAt, false, false)).toBe(false);
    expect(alarmIsLive(endsAt, endsAt, true, true)).toBe(false);
    expect(alarmIsLive(endsAt, endsAt + STALE_ALARM_MS + 1, true, false)).toBe(false);
  });
});
