import { describe, expect, it } from "vitest";
import type { LoggedSet, Session, SessionExercise } from "../lib/types";
import { restDecisionForSet, restOwner, restOwnerKey, restSkipStorageKey, restWindow } from "../lib/rest";

const start = "2026-10-04T10:00:00.000Z";

function set(options: Partial<LoggedSet> = {}): LoggedSet {
  return { weightLb: 10, reps: 8, rpe: null, done: false, skipped: false, ...options };
}

function exercise(
  exerciseId: string,
  options: { restSec?: number; supersetId?: string; sets?: LoggedSet[]; skipped?: boolean } = {},
): SessionExercise {
  return {
    exerciseId,
    name: exerciseId,
    skipped: options.skipped ?? false,
    ...(options.restSec === undefined ? {} : { restSec: options.restSec }),
    ...(options.supersetId ? { supersetId: options.supersetId } : {}),
    sets: options.sets ?? [set(), set()],
  };
}

function session(exercises: SessionExercise[], finishedAt: string | null = null): Session {
  return {
    id: "session/1",
    dayId: "day-a",
    dayName: "Day A",
    startedAt: start,
    finishedAt,
    sessionFeel: null,
    exercises,
  };
}

function doneAt(row: LoggedSet, timestamp: string): LoggedSet {
  row.done = true;
  row.doneAt = timestamp;
  return row;
}

describe("rest table", () => {
  it("uses an explicitly planned ramp rest, including inside a superset", () => {
    const current = session([
      exercise("a", {
        restSec: 60,
        supersetId: "pair",
        sets: [set({ warmup: true, restSec: 35 }), set()],
      }),
      exercise("b", { restSec: 45, supersetId: "pair" }),
    ]);
    doneAt(current.exercises[0].sets[0], start);
    expect(restDecisionForSet(current, 0, 0)).toEqual({ kind: "ramp", seconds: 35 });
    expect(restDecisionForSet(current, 1, 0)).toEqual({ kind: "handoff", seconds: null });
  });

  it("uses the round-closing exercise's rest, but not after the superset's final set", () => {
    const current = session([
      exercise("a", { restSec: 60, supersetId: "pair" }),
      exercise("b", { restSec: 45, supersetId: "pair" }),
    ]);
    doneAt(current.exercises[0].sets[0], "2026-10-04T10:00:01.000Z");
    doneAt(current.exercises[1].sets[0], "2026-10-04T10:00:02.000Z");
    expect(restDecisionForSet(current, 1, 0)).toEqual({ kind: "round", seconds: 45 });

    doneAt(current.exercises[0].sets[1], "2026-10-04T10:00:03.000Z");
    doneAt(current.exercises[1].sets[1], "2026-10-04T10:00:04.000Z");
    expect(restDecisionForSet(current, 1, 1)).toEqual({ kind: "last", seconds: null });
  });

  it("uses working-set rest outside a superset and omits it after the last set", () => {
    const current = session([exercise("lift", { restSec: 90 })]);
    doneAt(current.exercises[0].sets[0], "2026-10-04T10:00:01.000Z");
    expect(restDecisionForSet(current, 0, 0)).toEqual({ kind: "working", seconds: 90 });

    doneAt(current.exercises[0].sets[1], "2026-10-04T10:00:02.000Z");
    expect(restDecisionForSet(current, 0, 1)).toEqual({ kind: "last", seconds: null });
  });

  it("leaves rows without an exercise or ramp rest invisible", () => {
    const current = session([exercise("gap-filler", { sets: [set({ warmup: true }), set()] })]);
    expect(restDecisionForSet(current, 0, 0)).toBeUndefined();
    expect(restDecisionForSet(current, 0, 1)).toBeUndefined();
  });
});

describe("rest owner", () => {
  it("chooses the latest rest-relevant timestamp even when it is un-ticked or out of order", () => {
    const current = session([
      exercise("lift", {
        restSec: 60,
        sets: [
          set({ done: true, doneAt: "2026-10-04T10:00:20.000Z" }),
          set({ done: false, doneAt: "2026-10-04T10:00:30.000Z" }),
        ],
      }),
      exercise("gap-filler", { sets: [set({ done: true, doneAt: "2026-10-04T10:00:40.000Z" })] }),
    ]);

    expect(restOwner(current)?.setIndex).toBe(1);
    expect(restOwner(current)?.done).toBe(false);
    expect(restWindow(current)).toBeNull();
  });

  it("does not revive an earlier rest when the latest owner is un-ticked", () => {
    const current = session([
      exercise("lift-a", { restSec: 60, sets: [set({ done: true, doneAt: "2026-10-04T10:00:01.000Z" })] }),
      exercise("lift-b", { restSec: 90, sets: [set({ done: false, doneAt: "2026-10-04T10:00:02.000Z" })] }),
    ]);
    expect(restOwner(current)?.exerciseId).toBe("lift-b");
    expect(restWindow(current)).toBeNull();
  });

  it("keeps the current rest when a set or exercise is skipped (a skip writes no doneAt)", () => {
    const current = session([
      exercise("lift", { restSec: 60, sets: [set({ done: true, doneAt: "2026-10-04T10:00:10.000Z" }), set()] }),
      exercise("next", { restSec: 90, sets: [set({ skipped: true }), set()] }),
    ]);
    expect(restWindow(current)?.exerciseId).toBe("lift");

    current.exercises[1].skipped = true;
    expect(restWindow(current)?.exerciseId).toBe("lift");
  });

  it("cancels a rest on finish and makes the skip key specific to its owner", () => {
    const current = session([
      exercise("lift", { restSec: 60, sets: [set({ done: true, doneAt: "2026-10-04T10:00:10.000Z" })] }),
    ]);
    expect(restWindow(session(current.exercises, "2026-10-04T10:00:15.000Z"))).toBeNull();
    expect(restOwnerKey("lift", 0, "t1")).not.toBe(restOwnerKey("lift", 0, "t2"));
    expect(restSkipStorageKey("session/1", "lift:0:t1")).not.toBe(restSkipStorageKey("session/1", "lift:0:t2"));
  });
});
