import { describe, expect, it } from "vitest";
import { lastExerciseNote } from "../lib/notes";
import type { Session, SessionExercise } from "../lib/types";

function ex(exerciseId: string, over: Partial<SessionExercise> = {}): SessionExercise {
  return { exerciseId, name: exerciseId, skipped: false, sets: [], ...over };
}

function session(startedAt: string, exercises: SessionExercise[], dayId = "day-a"): Session {
  return {
    id: startedAt.replace(/[:.]/g, "-"),
    dayId,
    dayName: dayId,
    startedAt,
    finishedAt: startedAt,
    sessionFeel: null,
    exercises,
  };
}

const NOW = "2026-10-08T22:00:00.000Z";

describe("lastExerciseNote", () => {
  it("takes the note from the latest earlier session containing the exercise, on any day", () => {
    const sessions = [
      session("2026-10-01T22:00:00.000Z", [ex("row", { note: "old note" })]),
      session("2026-10-05T22:00:00.000Z", [ex("row", { note: "  per hand  " })], "day-b"),
      session("2026-10-06T22:00:00.000Z", [ex("squat", { note: "other lift" })]),
    ];
    expect(lastExerciseNote("row", sessions, NOW)).toEqual({ text: "per hand", startedAt: "2026-10-05T22:00:00.000Z" });
  });

  it("counts a session that skipped the exercise", () => {
    const sessions = [
      session("2026-10-01T22:00:00.000Z", [ex("fly", { note: "cable fly" })]),
      session("2026-10-05T22:00:00.000Z", [ex("fly", { skipped: true, note: "did machine fly instead" })]),
    ];
    expect(lastExerciseNote("fly", sessions, NOW)?.text).toBe("did machine fly instead");
  });

  it("does not fall back to an older note when the latest session has none", () => {
    const sessions = [
      session("2026-10-01T22:00:00.000Z", [ex("row", { note: "old note" })]),
      session("2026-10-05T22:00:00.000Z", [ex("row", { note: "   " })]),
    ];
    expect(lastExerciseNote("row", sessions, NOW)).toBeNull();
  });

  it("ignores the current and later sessions", () => {
    const sessions = [
      session("2026-10-01T22:00:00.000Z", [ex("row", { note: "earlier" })]),
      session(NOW, [ex("row", { note: "this session" })]),
      session("2026-10-09T22:00:00.000Z", [ex("row", { note: "later" })]),
    ];
    expect(lastExerciseNote("row", sessions, NOW)?.text).toBe("earlier");
  });

  it("returns null when no earlier session has the exercise", () => {
    expect(lastExerciseNote("row", [session("2026-10-01T22:00:00.000Z", [ex("squat")])], NOW)).toBeNull();
  });
});
