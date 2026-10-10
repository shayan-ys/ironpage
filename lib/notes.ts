import type { Session } from "./types";

/** An exercise note carried to the next session, with the session it came from. */
export interface LastExerciseNote {
  text: string;
  startedAt: string;
}

/**
 * The exercise note from the most recent session started before `before` that
 * included this exercise, on any day, even when that session skipped it: a skip
 * note ("did machine fly instead") is exactly what helps next time. That can be
 * a different session from the "last" reference row, which needs done working
 * sets. When that session has no note, there is nothing: older notes are not
 * consulted.
 */
export function lastExerciseNote(
  exerciseId: string,
  sessions: Session[],
  before: string,
): LastExerciseNote | null {
  let latest: Session | null = null;
  for (const s of sessions) {
    if (s.startedAt >= before || !s.exercises.some((e) => e.exerciseId === exerciseId)) continue;
    if (!latest || s.startedAt > latest.startedAt) latest = s;
  }
  const text = latest?.exercises.find((e) => e.exerciseId === exerciseId)?.note?.trim();
  return latest && text ? { text, startedAt: latest.startedAt } : null;
}
