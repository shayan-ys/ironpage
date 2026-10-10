import { describe, expect, it } from "vitest";
import {
  dayReadinessHint,
  muscleReadiness,
  readinessDose,
  recentDoses,
  summarizeMuscleImpact,
  withStoredMuscleImpact,
  type ReadinessDose,
} from "../lib/muscles";
import type { LoggedSet, ProgramDay, Session, SessionExercise } from "../lib/types";

const set = (done: boolean, extra: Partial<LoggedSet> = {}): LoggedSet => ({
  weightLb: 50, reps: 8, rpe: null, done, skipped: false, ...extra,
});

const session = (exercises: SessionExercise[]): Session => ({
  id: "s1", dayId: "gym-a", dayName: "A", startedAt: "2026-10-04T10:00:00Z",
  finishedAt: "2026-10-04T11:00:00Z", sessionFeel: null, exercises,
}) as Session;

const ex = (
  id: string,
  sets: LoggedSet[],
  muscles?: SessionExercise["muscles"],
  skipped = false,
  rpe?: number | null,
): SessionExercise => ({
  exerciseId: id, name: id, skipped, sets, ...(muscles ? { muscles } : {}), ...(rpe !== undefined ? { rpe } : {}),
});

const sets = (n: number) => Array.from({ length: n }, () => set(true));

describe("summarizeMuscleImpact", () => {
  it("counts score × effort weight per completed working set, excluding ramp, skipped and unticked rows", () => {
    const s = session([
      ex("deadlift", [
        set(true, { warmup: true }),
        set(true),
        set(true),
        set(false),
        set(true, { skipped: true }),
      ], { glutes: 1, hamstrings: 0.5 }, false, 9),
      ex("thrust", [set(true), set(true)], { glutes: 1 }, false, 6),
    ]);
    const r = summarizeMuscleImpact(s)!;
    expect(r.ranked.map((m) => [m.muscle, m.impact])).toEqual([
      ["glutes", 3],
      ["hamstrings", 1],
    ]);
  });

  it("weights an unrated, partly done exercise as RPE 8", () => {
    const r = summarizeMuscleImpact(session([ex("row", [set(true), set(true), set(false)], { lats: 1 }, false, null)]))!;
    expect(r.ranked[0].impact).toBe(1.7);
  });

  it("keeps ticked sets of an exercise skipped later", () => {
    const r = summarizeMuscleImpact(session([ex("row", [set(true), set(false)], { lats: 1 }, true, 9)]))!;
    expect(r.ranked).toEqual([expect.objectContaining({ muscle: "lats", impact: 1 })]);
  });

  it("colours against a fixed scale where level 5 starts at 8, not the session's top muscle", () => {
    const level = (n: number, rpe: number) =>
      summarizeMuscleImpact(session([ex("x", sets(n), { glutes: 1 }, false, rpe)]))!.ranked[0].level;
    expect(level(1, 6)).toBe(1); // 0.5
    expect(level(2, 9)).toBe(2); // 2
    expect(level(7, 9)).toBe(4); // 7
    expect(level(8, 9)).toBe(5); // 8
    expect(level(10, 6)).toBe(3); // 5: an easy day stays cool however many sets
  });

  it("treats a session without any snapshot as unknown, not zero", () => {
    expect(summarizeMuscleImpact(session([ex("old", [set(true)])]))).toBeNull();
  });
});

describe("withStoredMuscleImpact", () => {
  it("stores impact on a finished session and recomputes it after an edit", () => {
    const finished = session([ex("press", sets(3), { chest: 1, triceps: 0.5 }, false, 9)]);
    expect(withStoredMuscleImpact(finished).muscleImpact).toEqual({ chest: 3, triceps: 1.5 });

    const edited = { ...finished, muscleImpact: { chest: 3, triceps: 1.5 }, exercises: [ex("press", [set(true)], { chest: 1, triceps: 0.5 }, false, 9)] };
    expect(withStoredMuscleImpact(edited).muscleImpact).toEqual({ chest: 1, triceps: 0.5 });
  });

  it("stores nothing for an open session or one without snapshots", () => {
    const open = { ...session([ex("press", sets(3), { chest: 1 }, false, 9)]), finishedAt: null, muscleImpact: { chest: 9 } };
    expect(withStoredMuscleImpact(open)).not.toHaveProperty("muscleImpact");
    expect(withStoredMuscleImpact(session([ex("old", [set(true)])]))).not.toHaveProperty("muscleImpact");
  });
});

describe("muscleReadiness", () => {
  const H = 3_600_000;
  const finished = Date.parse("2026-10-04T11:00:00Z");
  const dose = (impact: ReadinessDose["impact"], hoursBeforeNow = 0, id = "s1"): ReadinessDose => ({
    id, trainedAt: new Date(finished - hoursBeforeNow * H).toISOString(), impact,
  });

  it("halves fatigue every 18 h, reads 0% at 8 units and is uncoloured at 90% or more", () => {
    const doses = [dose({ quads: 8 })];
    expect(muscleReadiness(doses, finished)!.quads).toEqual({ fatigue: 8, readiness: 0, level: 5 });
    expect(muscleReadiness(doses, finished + 18 * H)!.quads).toMatchObject({ fatigue: 4, readiness: 50, level: 3 });
    expect(muscleReadiness(doses, finished + 36 * H)!.quads).toMatchObject({ fatigue: 2, readiness: 75, level: 2 });
    // log2(8 / 0.8) half-lives ≈ 60 h: the 90% line, where colour stops.
    expect(muscleReadiness(doses, finished + 59 * H)!.quads.level).toBe(1);
    expect(muscleReadiness(doses, finished + 60 * H)!.quads).toMatchObject({ readiness: 90, level: 0 });
    expect(muscleReadiness(doses, finished)!.chest).toEqual({ fatigue: 0, readiness: 100, level: 0 });
  });

  it("stacks back-to-back sessions and caps at 0% rather than going negative", () => {
    const r = muscleReadiness([dose({ glutes: 6 }, 18, "a"), dose({ glutes: 6 }, 0, "b")], finished)!;
    expect(r.glutes).toMatchObject({ fatigue: 9, readiness: 0, level: 5 });
  });

  it("lets a later copy of the same session replace the earlier one", () => {
    const r = muscleReadiness([dose({ biceps: 2 }), dose({ biceps: 4 })], finished)!;
    expect(r.biceps.fatigue).toBe(4);
  });

  it("returns null with nothing in the 7-day window, not a fully ready body", () => {
    expect(muscleReadiness([], finished)).toBeNull();
    expect(muscleReadiness([dose({ quads: 8 })], finished + 7 * 24 * H)).not.toBeNull();
    expect(muscleReadiness([dose({ quads: 8 })], finished + 7 * 24 * H + 1)).toBeNull();
  });

  it("doses only finished sessions with a working set and snapshots, preferring the stored impact", () => {
    const done = session([ex("squat", sets(2), { quads: 1 }, false, 9)]);
    const stored = { ...done, id: "stored", muscleImpact: { quads: 5 } };
    const open = { ...done, id: "open", finishedAt: null };
    const legacy = { ...session([ex("old", [set(true)])]), id: "legacy" };
    const empty = { ...session([ex("squat", [set(false)], { quads: 1 })]), id: "empty" };
    const doses = recentDoses([done, stored, open, legacy, empty], finished);
    expect(doses.map((d) => [d.id, d.impact])).toEqual([["s1", { quads: 2 }], ["stored", { quads: 5 }]]);
    // A device copy ignores its stored value, which can predate an offline edit.
    expect(readinessDose(stored, false)!.impact).toEqual({ quads: 2 });
  });

  it("dates a dose by its last working set, not by when the session was closed", () => {
    const lifted = "2026-10-04T10:40:00Z";
    const timedOut = {
      ...session([ex("squat", [set(true, { doneAt: lifted })], { quads: 1 }, false, 9)]),
      finishedAt: "2026-10-07T10:40:00Z",
    };
    const dose = readinessDose(timedOut)!;
    expect(dose.trainedAt).toBe(lifted);
    expect(muscleReadiness([dose], Date.parse(lifted) + 18 * H)!.quads.fatigue).toBeCloseTo(0.5);
    // A workout from an hour ago is in the window.
    expect(recentDoses([timedOut], Date.parse(lifted) + H)).toHaveLength(1);
  });
});

describe("dayReadinessHint", () => {
  const day = (muscles: SessionExercise["muscles"][]): ProgramDay => ({
    id: "d", name: "D",
    exercises: muscles.map((m, i) => ({
      id: `e${i}`, name: `e${i}`, targetSets: 3, targetReps: 8, targetRPE: 8, seedWeight: 0, seedIsGuess: false, muscles: m,
    })),
  }) as ProgramDay;
  const now = Date.parse("2026-10-04T11:00:00Z");
  const legs = day([{ quads: 1, glutes: 0.75, hamstrings: 1, calves: 0.5 }]);

  it("names up to two least-ready targets (score ≥ 0.75), ignoring minor muscles", () => {
    const r = muscleReadiness([{ id: "a", trainedAt: "2026-10-04T11:00:00Z", impact: { quads: 3, glutes: 6, hamstrings: 1, calves: 8 } }], now);
    expect(dayReadinessHint(legs, r)).toBe("Glutes 25% · Quads 62%");
  });

  it("says ready when every target is at 90% or more, and nothing without data", () => {
    const r = muscleReadiness([{ id: "a", trainedAt: "2026-10-04T11:00:00Z", impact: { quads: 0.8, calves: 8 } }], now);
    expect(dayReadinessHint(legs, r)).toBe("Muscles ready");
    expect(dayReadinessHint(legs, null)).toBeNull();
  });
});
