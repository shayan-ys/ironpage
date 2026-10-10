import type { LoggedSet, Unit } from "./types";

/**
 * Ramp-set tooling. This is *machinery*, not programme content: it decides
 * nothing about which exercises deserve ramp sets or how many — you add them
 * per exercise, in the session, by hand. All it does is propose sane starting
 * numbers so a new ramp row isn't a blank you have to dial in from zero.
 *
 * The ladder tapers load upward while cutting reps, the standard shape: enough
 * specific practice at the movement to be useful, never enough volume to eat
 * into the working sets that follow.
 */

/**
 * Ramp sets are meant to feel easy — that's the point of them. The working
 * target RPE would be actively wrong here, so the chip on a ramp row aims at
 * this instead. It's only a default; the slider still moves.
 */
export const RAMP_TARGET_RPE = 6;

/** Percentage of the working weight, and reps, per ramp set in order. */
const LADDER = [
  { pct: 0.5, reps: 8 },
  { pct: 0.65, reps: 5 },
  { pct: 0.8, reps: 3 },
  { pct: 0.875, reps: 2 },
] as const;

/**
 * Smallest loadable increment per unit: 2.5 lb or 1.25 kg. Ramp loads round to
 * a multiple of this, so the proposed number is one you can actually load.
 */
export const RAMP_STEP: Record<Unit, number> = { lb: 2.5, kg: 1.25 };

/**
 * How many ramp sets sit at the front of this exercise. Ramp sets are always a
 * leading run — you warm up before you work, never after — so this doubles as
 * the insertion index for the next one.
 */
export function leadingWarmupCount(sets: LoggedSet[]): number {
  let n = 0;
  while (n < sets.length && sets[n].warmup) n++;
  return n;
}

/**
 * Proposed ramp set number `ordinal` (0-based) for a lift whose working set is
 * `workingWeight` × `workingReps`, both in `unit`. Past the end of the ladder
 * every extra set repeats the top rung rather than climbing into the working
 * weight.
 */
export function buildRampSet(
  workingWeight: number,
  workingReps: number,
  ordinal: number,
  unit: Unit,
): LoggedSet {
  const rung = LADDER[Math.min(ordinal, LADDER.length - 1)];
  const step = RAMP_STEP[unit];
  return {
    // Rounded to the nearest loadable increment for the unit, so the number is
    // one you can actually put on the bar.
    weightLb: Math.round((workingWeight * rung.pct) / step) * step,
    // Never prescribe more ramp reps than the working set itself; on a 3-rep
    // top set an 8-rep "warm-up" is just a second workout.
    reps: Math.min(rung.reps, Math.max(workingReps, 1)),
    rpe: null,
    done: false,
    skipped: false,
    warmup: true,
  };
}
