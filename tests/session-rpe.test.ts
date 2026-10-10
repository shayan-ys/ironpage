import { describe, expect, it } from "vitest";
import { shouldOpenExerciseRpe } from "../lib/session-rpe";
import type { LoggedSet } from "../lib/types";

function makeSet(overrides: Partial<LoggedSet> = {}): LoggedSet {
  return {
    weightLb: 100,
    reps: 5,
    rpe: null,
    done: false,
    skipped: false,
    ...overrides,
  };
}

describe("shouldOpenExerciseRpe", () => {
  it("opens after the final non-warm-up set is completed", () => {
    const sets = [makeSet({ warmup: true, done: true }), makeSet({ done: true }), makeSet({ done: true })];

    expect(shouldOpenExerciseRpe(sets, 2)).toBe(true);
  });

  it("stays closed when working sets remain incomplete", () => {
    const sets = [makeSet({ done: true }), makeSet()];

    expect(shouldOpenExerciseRpe(sets, 0)).toBe(false);
  });

  it("stays closed when the completed set is a warm-up", () => {
    const sets = [makeSet({ warmup: true, done: true }), makeSet({ done: true })];

    expect(shouldOpenExerciseRpe(sets, 0)).toBe(false);
  });

  it("stays closed when a working set was toggled off", () => {
    const sets = [makeSet({ done: true }), makeSet({ done: false })];

    expect(shouldOpenExerciseRpe(sets, 1)).toBe(false);
  });

  it("treats skipped remaining working sets as settled", () => {
    const sets = [makeSet({ done: true }), makeSet({ skipped: true })];

    expect(shouldOpenExerciseRpe(sets, 0)).toBe(true);
  });
});
