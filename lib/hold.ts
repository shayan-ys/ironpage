import { canCompleteSet } from "./set-order";
import type { Session } from "./types";

/** The longest hold the seconds wheel offers on a timed row. */
export const HOLD_MAX_SECONDS = 120;

/**
 * Whether row `s` of exercise `e` offers its hold timer now: the exercise is
 * timed, the row is open with a positive hold length (its `reps`, in seconds),
 * and the set-order rule would accept a tick on it.
 */
export function canStartHold(session: Session, e: number, s: number): boolean {
  const exercise = session.exercises[e];
  const set = exercise?.sets[s];
  if (session.finishedAt || !exercise?.timed || exercise.skipped || !set) return false;
  if (set.done || set.skipped || !(set.reps > 0)) return false;
  return canCompleteSet(session, e, s);
}

/** The hold countdown's face: whole seconds remaining, m:ss from one minute. */
export function holdLabel(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  if (seconds < 60) return String(seconds);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
