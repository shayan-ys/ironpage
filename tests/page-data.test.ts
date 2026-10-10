import { describe, expect, it } from "vitest";
import { sessionProps } from "../lib/page-data";
import type { Program, Session } from "../lib/types";

const program: Program = {
  unit: "kg",
  days: [
    {
      id: "day-a",
      name: "Day A",
      exercises: [
        {
          id: "back-squat",
          name: "Back squat",
          targetSets: 1,
          targetReps: 5,
          targetRPE: 8,
          seedWeight: 60,
          seedIsGuess: false,
          notes: [{ label: "Cue", text: "brace" }],
        },
      ],
    },
  ],
};

function session(id: string, startedAt: string, weightLb: number, unit?: Session["unit"]): Session {
  return {
    id,
    dayId: "day-a",
    dayName: "Day A",
    startedAt,
    finishedAt: null,
    sessionFeel: null,
    ...(unit ? { unit } : {}),
    exercises: [
      {
        exerciseId: "back-squat",
        name: "Back squat",
        skipped: false,
        sets: [{ weightLb, reps: 5, rpe: null, done: true, skipped: false }],
      },
    ],
  };
}

describe("sessionProps last reference", () => {
  const current = session("now", "2026-10-10T12:00:00Z", 60, "kg");
  const last = (all: Session[]) => sessionProps(current, program, [current, ...all]).meta["back-squat"].lastSets;

  it("skips a session logged in the other unit", () => {
    expect(last([session("lb", "2026-10-08T12:00:00Z", 160, "lb")])).toBeUndefined();
  });

  it("uses the newest session in the program's unit", () => {
    const sets = last([session("kg", "2026-10-01T12:00:00Z", 70, "kg"), session("lb", "2026-10-08T12:00:00Z", 160, "lb")]);
    expect(sets).toEqual([{ weightLb: 70, reps: 5 }]);
  });

  it("uses a legacy session without a unit", () => {
    expect(last([session("old", "2026-10-08T12:00:00Z", 75)])).toEqual([{ weightLb: 75, reps: 5 }]);
  });
});
