import type { ProgramDay, ProgramExercise, Unit } from "../types";

/**
 * Picks a hand-chosen load for the program's unit. Both numbers are written
 * out, not converted, so a kg program gets plates a gym actually has
 * (20 kg, not 20.4).
 */
export type Weigh = (lb: number, kg: number) => number;

export const weigh =
  (unit: Unit): Weigh =>
  (lb, kg) =>
    unit === "kg" ? kg : lb;

/** One exercise from the catalog, given the program's loads. */
export type ExerciseFactory = (w: Weigh, unit: Unit) => ProgramExercise;

type Warmup = NonNullable<ProgramDay["warmup"]>;

export const FULL_BODY_WARMUP: Warmup = {
  total: "~6 min",
  note: "Then start the first lift light and build up over a set or two.",
  drills: [
    { name: "Easy bike, rower or brisk walk", dose: "3 min", why: "warms you up and gets you breathing" },
    { name: "Bodyweight squat", dose: "10 reps", why: "knees, hips and ankles through a full range" },
    { name: "Hip hinge with a dowel or hands on hips", dose: "8 reps", why: "rehearses a flat back for the hinge" },
    { name: "Band pull-apart", dose: "15 reps", why: "upper back and shoulders on before pressing and pulling" },
  ],
};

export const LOWER_WARMUP: Warmup = {
  total: "~6 min",
  note: "Then ramp into the first lift.",
  drills: [
    { name: "Easy bike or incline walk", dose: "3 min", why: "warms the legs" },
    { name: "World's greatest stretch", dose: "4 / side", why: "hip flexors, hamstrings and upper back in one move" },
    { name: "Glute bridge", dose: "12 reps · 1 s squeeze", why: "glutes on before squats and hinges" },
    { name: "Bodyweight squat to a pause", dose: "8 reps", why: "grooves depth and knee tracking" },
  ],
};

export const UPPER_WARMUP: Warmup = {
  total: "~5 min",
  note: "Then ramp into the first press.",
  drills: [
    { name: "Arm circles, small to big", dose: "10 each way", why: "loosens the shoulders" },
    { name: "Band pull-apart", dose: "15 reps", why: "upper back on to hold the shoulders in place" },
    { name: "Band external rotation", dose: "12 / side", why: "rotator cuff ready for pressing" },
    { name: "Scapular push-up", dose: "10 reps", why: "shoulder-blade control under load" },
  ],
};

export const PULL_WARMUP: Warmup = {
  total: "~5 min",
  note: "Then start the first pull light.",
  drills: [
    { name: "Easy rower", dose: "3 min", why: "warms the back and arms together" },
    { name: "Dead hang or scapular pull-up", dose: "2 × 8", why: "shoulder blades down before pulling" },
    { name: "Band pull-apart", dose: "15 reps", why: "rear delts and upper back on" },
    { name: "Cat-cow", dose: "8 reps", why: "moves the spine before rowing" },
  ],
};
