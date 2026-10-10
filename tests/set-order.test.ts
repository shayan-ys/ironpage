import { describe, expect, it } from "vitest";
import type { LoggedSet, Session } from "../lib/types";
import { canCompleteSet } from "../lib/set-order";

type Row = "ramp" | "ramp-done" | "pending" | "done" | "skipped";

function row(kind: Row): LoggedSet {
  return {
    weightLb: 10,
    reps: 8,
    rpe: null,
    done: kind === "done" || kind === "ramp-done",
    skipped: kind === "skipped",
    ...(kind === "ramp" || kind === "ramp-done" ? { warmup: true } : {}),
  };
}

function session(...exercises: Row[][]): Session {
  return {
    id: "s1",
    dayId: "day-a",
    dayName: "Day A",
    startedAt: "2026-10-01T10:00:00.000Z",
    finishedAt: null,
    sessionFeel: null,
    exercises: exercises.map((rows, index) => ({
      exerciseId: `ex-${index}`,
      name: `ex-${index}`,
      skipped: false,
      sets: rows.map(row),
    })),
  };
}

describe("canCompleteSet", () => {
  it("lets ramp rows complete in any order", () => {
    const s = session(["ramp", "ramp", "ramp", "pending"]);
    expect(canCompleteSet(s, 0, 0)).toBe(true);
    expect(canCompleteSet(s, 0, 1)).toBe(true);
    expect(canCompleteSet(s, 0, 2)).toBe(true);
  });

  it("allows the first working row while ramp rows are still pending", () => {
    const s = session(["ramp", "ramp", "pending", "pending"]);
    expect(canCompleteSet(s, 0, 2)).toBe(true);
  });

  it("blocks working row 2 while working row 1 is pending", () => {
    const s = session(["ramp", "pending", "pending", "pending"]);
    expect(canCompleteSet(s, 0, 2)).toBe(false);
    expect(canCompleteSet(s, 0, 3)).toBe(false);
  });

  it("allows working row 2 once row 1 is done", () => {
    const s = session(["ramp", "done", "pending", "pending"]);
    expect(canCompleteSet(s, 0, 2)).toBe(true);
    expect(canCompleteSet(s, 0, 3)).toBe(false);
  });

  it("counts a skipped working row as resolved", () => {
    const s = session(["skipped", "pending", "pending"]);
    expect(canCompleteSet(s, 0, 1)).toBe(true);
    expect(canCompleteSet(s, 0, 2)).toBe(false);
  });

  it("always allows un-ticking a done row, even with an earlier pending row", () => {
    const s = session(["pending", "done"]);
    expect(canCompleteSet(s, 0, 1)).toBe(true);
  });

  it("allows a done ramp row to be un-ticked", () => {
    const s = session(["ramp-done", "pending"]);
    expect(canCompleteSet(s, 0, 0)).toBe(true);
  });

  it("applies the rule within one exercise only", () => {
    const s = session(["pending", "pending"], ["pending", "pending"]);
    expect(canCompleteSet(s, 1, 0)).toBe(true);
    expect(canCompleteSet(s, 1, 1)).toBe(false);
  });

  it("rejects an out-of-range row", () => {
    const s = session(["pending"]);
    expect(canCompleteSet(s, 0, 5)).toBe(false);
    expect(canCompleteSet(s, 3, 0)).toBe(false);
  });
});
