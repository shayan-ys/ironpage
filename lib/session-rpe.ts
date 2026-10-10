import type { LoggedSet } from "./types";

/** Whether completing this set finishes the exercise's working sets. */
export function shouldOpenExerciseRpe(sets: LoggedSet[], completedSetIndex: number): boolean {
  const completed = sets[completedSetIndex];
  if (!completed || completed.warmup || !completed.done || completed.skipped) return false;

  const working = sets.filter((set) => !set.warmup);
  return working.length > 0 && working.every((set) => set.done || set.skipped);
}
