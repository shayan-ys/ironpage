import type { StarterProgram } from "./index";
import { FULL_BODY_WARMUP, weigh } from "./shared";
import * as ex from "./exercises";

export const strength5x5: StarterProgram = {
  id: "strength-5x5",
  name: "5×5 Strength",
  summary:
    "Two alternating barbell workouts, three times a week: squat every session, five sets of five, a little more weight each time.",
  daysPerWeek: 3,
  level: "beginner",
  build(unit) {
    const w = weigh(unit);
    // Planned ramp sets for the squat: an empty-bar set, then one in between.
    // They stay as written while the work weight climbs; raise them once the
    // gap to the work sets gets large.
    const squat = {
      ...ex.backSquat(w, unit),
      targetSets: 5,
      targetRPE: 7,
      seedWeight: w(95, 40),
      rampSets: [
        { weightLb: w(45, 20), reps: 5, restSec: 60 },
        { weightLb: w(65, 30), reps: 3, restSec: 90 },
      ],
    };
    const fiveByFive = { targetSets: 5, targetReps: 5, targetRPE: 7 };
    return {
      unit,
      days: [
        {
          id: "strength-5x5-a",
          name: "Workout A",
          warmup: FULL_BODY_WARMUP,
          exercises: [squat, { ...ex.benchPress(w, unit), ...fiveByFive }, { ...ex.barbellRow(w, unit), ...fiveByFive }],
        },
        {
          id: "strength-5x5-b",
          name: "Workout B",
          warmup: FULL_BODY_WARMUP,
          exercises: [
            squat,
            { ...ex.overheadPress(w, unit), ...fiveByFive },
            { ...ex.deadlift(w, unit), targetRPE: 7, seedWeight: w(95, 40) },
          ],
        },
      ],
    };
  },
};
