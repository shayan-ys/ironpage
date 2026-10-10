import type { StarterProgram } from "./index";
import { LOWER_WARMUP, PULL_WARMUP, UPPER_WARMUP, weigh } from "./shared";
import * as ex from "./exercises";

export const pushPullLegs: StarterProgram = {
  id: "push-pull-legs",
  name: "Push / Pull / Legs",
  summary:
    "Pressing, pulling and legs on separate days. Run the three days once a week, or go through twice for six days when you can recover from it.",
  daysPerWeek: 3,
  level: "intermediate",
  build(unit) {
    const w = weigh(unit);
    return {
      unit,
      days: [
        {
          id: "push-pull-legs-push",
          name: "Push",
          warmup: UPPER_WARMUP,
          exercises: [
            { ...ex.benchPress(w, unit), targetSets: 4, targetReps: 6, seedWeight: w(135, 60) },
            { ...ex.overheadPress(w, unit), targetReps: 8, seedWeight: w(75, 35), seedIsGuess: true },
            ex.inclineDumbbellPress(w, unit),
            ex.lateralRaise(w, unit),
            ex.tricepsPushdown(w, unit),
          ],
        },
        {
          id: "push-pull-legs-pull",
          name: "Pull",
          warmup: PULL_WARMUP,
          exercises: [
            { ...ex.latPulldown(w, unit), targetSets: 4, targetReps: 8, seedWeight: w(100, 45) },
            { ...ex.barbellRow(w, unit), seedWeight: w(115, 50) },
            ex.seatedCableRow(w, unit),
            ex.facePull(w, unit),
            ex.dumbbellCurl(w, unit),
            ex.hammerCurl(w, unit),
          ],
        },
        {
          id: "push-pull-legs-legs",
          name: "Legs",
          warmup: LOWER_WARMUP,
          exercises: [
            { ...ex.backSquat(w, unit), targetSets: 4, targetReps: 6, seedWeight: w(155, 70) },
            { ...ex.romanianDeadlift(w, unit), seedWeight: w(135, 60) },
            ex.legPress(w, unit),
            ex.seatedLegCurl(w, unit),
            ex.standingCalfRaise(w, unit),
          ],
        },
      ],
    };
  },
};
