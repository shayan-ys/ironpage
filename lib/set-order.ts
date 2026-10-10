import type { Session } from "./types";

/**
 * Whether a tick on row `s` of exercise `e` may complete it now. Working sets
 * complete in order: a row waits until every earlier working row of the same
 * exercise is done or skipped. Ramp rows complete in any order and never block
 * a working set. Un-ticking a done row is always allowed.
 */
export function canCompleteSet(session: Session, e: number, s: number): boolean {
  const sets = session.exercises[e]?.sets;
  const set = sets?.[s];
  if (!sets || !set) return false;
  if (set.done || set.warmup) return true;
  return sets.slice(0, s).every((row) => row.warmup || row.done || row.skipped);
}
