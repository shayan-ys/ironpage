import { activeTarget } from "./defaults";
import type { ProgramExercise } from "./types";

/** One week step on the notes sheet: its weight floor and effective reps. */
export interface WeekChip {
  weightLb?: number;
  /** The step's reps, else the exercise's `targetReps` (as session start uses). */
  reps: number;
  state: "past" | "now" | "next";
}

export interface ProgramWeeks {
  chips: WeekChip[];
  /** Reps differ between steps, so every chip shows them. */
  showReps: boolean;
}

/**
 * The exercise's dated target steps as the notes sheet's Weeks row, read from
 * `targets` so the planner writes no progression text for it. The step that
 * applies at `at` is "now". Null when there is nothing to show: fewer than two
 * steps, or no step sets a weight and the reps never change (a find-your-load
 * exercise).
 */
export function programWeeks(pe: ProgramExercise, at: Date): ProgramWeeks | null {
  const steps = (pe.targets ?? [])
    .filter((s) => Number.isFinite(Date.parse(s.from)))
    .sort((a, b) => Date.parse(a.from) - Date.parse(b.from));
  if (steps.length < 2) return null;
  const active = activeTarget(pe, at);
  const activeFrom = active ? Date.parse(active.from) : -Infinity;
  const chips: WeekChip[] = steps.map((s) => ({
    weightLb: s.weightLb,
    reps: s.reps ?? pe.targetReps,
    state: s === active ? "now" : Date.parse(s.from) < activeFrom ? "past" : "next",
  }));
  const showReps = chips.some((c) => c.reps !== chips[0].reps);
  if (!showReps && chips.every((c) => c.weightLb === undefined)) return null;
  return { chips, showReps };
}
