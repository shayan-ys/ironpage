import type { StarterProgram } from "./index";
import { LOWER_WARMUP, UPPER_WARMUP, weigh } from "./shared";
import * as ex from "./exercises";

export const upperLower: StarterProgram = {
  id: "upper-lower",
  name: "Upper / Lower",
  summary:
    "Four days: each muscle twice a week, a heavy barbell lift to open every day and accessories after. For lifters who know the main lifts.",
  daysPerWeek: 4,
  level: "intermediate",
  build(unit) {
    const w = weigh(unit);
    return {
      unit,
      days: [
        {
          id: "upper-lower-upper-a",
          name: "Upper A",
          warmup: UPPER_WARMUP,
          exercises: [
            { ...ex.benchPress(w, unit), targetSets: 4, targetReps: 6, seedWeight: w(135, 60) },
            { ...ex.barbellRow(w, unit), targetSets: 4, seedWeight: w(115, 50) },
            ex.dumbbellShoulderPress(w, unit),
            ex.latPulldown(w, unit),
            // Superset: alternate curl and pushdown, resting after each pair.
            { ...ex.dumbbellCurl(w, unit), restSec: 75, supersetId: "arms" },
            { ...ex.tricepsPushdown(w, unit), restSec: 75, supersetId: "arms" },
          ],
        },
        {
          id: "upper-lower-lower-a",
          name: "Lower A",
          warmup: LOWER_WARMUP,
          exercises: [
            { ...ex.backSquat(w, unit), targetSets: 4, targetReps: 6, seedWeight: w(155, 70) },
            { ...ex.romanianDeadlift(w, unit), seedWeight: w(135, 60) },
            ex.legPress(w, unit),
            ex.seatedLegCurl(w, unit),
            ex.standingCalfRaise(w, unit),
          ],
        },
        {
          id: "upper-lower-upper-b",
          name: "Upper B",
          warmup: UPPER_WARMUP,
          exercises: [
            { ...ex.overheadPress(w, unit), targetSets: 4, targetReps: 6, seedWeight: w(85, 40), seedIsGuess: true },
            ex.chinUp(w, unit),
            ex.inclineDumbbellPress(w, unit),
            ex.oneArmDumbbellRow(w, unit),
            ex.lateralRaise(w, unit),
            ex.facePull(w, unit),
          ],
        },
        {
          id: "upper-lower-lower-b",
          name: "Lower B",
          warmup: LOWER_WARMUP,
          exercises: [
            { ...ex.deadlift(w, unit), targetSets: 3, seedWeight: w(185, 80) },
            ex.bulgarianSplitSquat(w, unit),
            { ...ex.hipThrust(w, unit), seedWeight: w(135, 60) },
            ex.legExtension(w, unit),
            ex.hangingKneeRaise(w, unit),
          ],
        },
      ],
    };
  },
};
