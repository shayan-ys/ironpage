import { describe, expect, it } from "vitest";
import { programWeeks } from "../lib/program-notes";
import type { ProgramExercise } from "../lib/types";

function exercise(over: Partial<ProgramExercise> = {}): ProgramExercise {
  return {
    id: "calf",
    name: "Calf",
    targetSets: 3,
    targetReps: 10,
    targetRPE: 9,
    seedWeight: 140,
    seedIsGuess: false,
    notes: [{ label: "Cue", text: "deep stretch" }],
    ...over,
  };
}

describe("programWeeks", () => {
  const steps = [
    { from: "2026-09-29T00:00:00-04:00", weightLb: 100 },
    { from: "2026-10-06T00:00:00-04:00", weightLb: 120, reps: 10 },
    { from: "2026-10-13T00:00:00-04:00", weightLb: 120, reps: 12 },
    { from: "2026-10-20T00:00:00-04:00", weightLb: 130 },
  ];

  it("falls back to targetReps, so a return to base reps shows on every chip", () => {
    const weeks = programWeeks(exercise({ targets: steps }), new Date("2026-10-08T18:00:00-04:00"));
    expect(weeks?.showReps).toBe(true);
    expect(weeks?.chips.map((c) => [c.weightLb, c.reps, c.state])).toEqual([
      [100, 10, "past"],
      [120, 10, "now"],
      [120, 12, "next"],
      [130, 10, "next"],
    ]);
  });

  it("marks no week as now before the first step and hides reps that never change", () => {
    const weeks = programWeeks(
      exercise({ targets: [steps[0], { from: steps[3].from, weightLb: 130 }] }),
      new Date("2026-09-20T12:00:00-04:00"),
    );
    expect(weeks).toEqual({
      showReps: false,
      chips: [
        { weightLb: 100, reps: 10, state: "next" },
        { weightLb: 130, reps: 10, state: "next" },
      ],
    });
  });

  it("shows nothing for a find-your-load exercise or a single step", () => {
    const at = new Date("2026-10-08T18:00:00-04:00");
    expect(programWeeks(exercise({ targets: [{ from: steps[0].from, sets: 2 }, { from: steps[1].from }] }), at)).toBeNull();
    expect(programWeeks(exercise({ targets: [steps[1]] }), at)).toBeNull();
  });
});
