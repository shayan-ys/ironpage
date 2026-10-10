import { describe, expect, it } from "vitest";
import type { Session, SessionExercise } from "../lib/types";
import { currentSet, groupExercises, supersetRound, tickCompletesSupersetRound } from "../lib/supersets";

function exercise(
  exerciseId: string,
  options: { supersetId?: string; sets?: SessionExercise["sets"]; skipped?: boolean } = {},
): SessionExercise {
  return {
    exerciseId,
    name: exerciseId,
    skipped: options.skipped ?? false,
    ...(options.supersetId ? { supersetId: options.supersetId } : {}),
    sets: options.sets ?? [1, 2].map(() => ({ weightLb: 10, reps: 8, rpe: null, done: false, skipped: false })),
  };
}

function session(exercises: SessionExercise[]): Session {
  return {
    id: "s1",
    dayId: "day-a",
    dayName: "Day A",
    startedAt: "2026-10-01T10:00:00.000Z",
    finishedAt: null,
    sessionFeel: null,
    exercises,
  };
}

function completed(count: number, total: number): SessionExercise["sets"] {
  return Array.from({ length: total }, (_, index) => ({
    weightLb: 10,
    reps: 8,
    rpe: null,
    done: index < count,
    skipped: false,
    ...(index < count ? { doneAt: `2026-10-01T10:00:0${index}.000Z` } : {}),
  }));
}

const member = (id: string, sets: SessionExercise["sets"]) => exercise(id, { supersetId: "pair", sets });

describe("superset current set", () => {
  it("finishes pending ramps across members in program order before working sets", () => {
    const a = member("a", [
      { weightLb: 5, reps: 8, rpe: null, done: true, skipped: false, warmup: true },
      { weightLb: 10, reps: 8, rpe: null, done: false, skipped: false },
    ]);
    const b = member("b", [
      { weightLb: 5, reps: 8, rpe: null, done: false, skipped: false, warmup: true },
      { weightLb: 10, reps: 8, rpe: null, done: false, skipped: false },
    ]);

    expect(currentSet(session([a, b]))).toEqual({ e: 1, s: 0 });
    a.sets[0].done = false;
    expect(currentSet(session([a, b]))).toEqual({ e: 0, s: 0 });
  });

  it("corrects out-of-order ticks and breaks ties by program order", () => {
    const current = session([member("a", completed(0, 2)), member("b", completed(0, 2))]);
    current.exercises[1].sets[0].done = true;
    current.exercises[1].sets[0].doneAt = "2026-10-01T10:00:01.000Z";
    expect(currentSet(current)).toEqual({ e: 0, s: 0 });

    current.exercises[0].sets[0].done = true;
    current.exercises[0].sets[0].doneAt = "2026-10-01T10:00:02.000Z";
    expect(currentSet(current)).toEqual({ e: 0, s: 1 });
  });

  it("drops skipped and finished members, then continues in exercise order", () => {
    const a = member("a", completed(2, 2));
    const b = member("b", completed(0, 2));
    const c = exercise("c", { sets: completed(0, 1) });
    expect(currentSet(session([a, b, c]))).toEqual({ e: 1, s: 0 });

    b.skipped = true;
    expect(currentSet(session([a, b, c]))).toEqual({ e: 2, s: 0 });
  });

  it("keeps non-superset ordering unchanged and splits non-adjacent ids", () => {
    const a = exercise("a", { supersetId: "pair", sets: completed(0, 2) });
    const middle = exercise("middle", { sets: completed(0, 1) });
    const b = exercise("b", { supersetId: "pair", sets: completed(0, 2) });
    expect(groupExercises([a, middle, b])).toEqual([
      { start: 0, end: 0, supersetId: "pair" },
      { start: 1, end: 1, supersetId: null },
      { start: 2, end: 2, supersetId: "pair" },
    ]);
    expect(currentSet(session([a, middle, b]))).toEqual({ e: 0, s: 0 });
  });
});

describe("superset rounds", () => {
  it("recognizes a round-closing tick after the partner has completed that round", () => {
    const current = session([member("a", completed(1, 3)), member("b", completed(0, 3))]);
    expect(supersetRound(current, 1, 0)).toBe(1);
    expect(tickCompletesSupersetRound(current, 1, 0)).toBe(true);
    expect(tickCompletesSupersetRound(current, 0, 1)).toBe(false);
  });

  it("closes the fourth round with only A in a four-versus-three pairing", () => {
    const current = session([member("a", completed(3, 4)), member("b", completed(3, 3))]);
    expect(supersetRound(current, 0, 3)).toBe(4);
    expect(tickCompletesSupersetRound(current, 0, 3)).toBe(true);
  });

  it("does not treat an exercise outside the adjacent run as a round member", () => {
    const current = session([
      member("a", completed(0, 2)),
      exercise("middle", { sets: completed(0, 1) }),
      member("b", completed(0, 2)),
    ]);
    expect(tickCompletesSupersetRound(current, 0, 0)).toBe(false);
  });
});
