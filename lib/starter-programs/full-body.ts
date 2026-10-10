import type { StarterProgram } from "./index";
import { FULL_BODY_WARMUP, weigh } from "./shared";
import * as ex from "./exercises";

export const fullBody: StarterProgram = {
  id: "full-body",
  name: "Full Body",
  summary:
    "Three whole-body sessions a week with dumbbells, cables and machines. A gentle way in: moderate effort, room to learn each lift.",
  daysPerWeek: 3,
  level: "beginner",
  build(unit) {
    const w = weigh(unit);
    return {
      unit,
      days: [
        {
          id: "full-body-a",
          name: "Full Body A",
          warmup: FULL_BODY_WARMUP,
          exercises: [
            ex.gobletSquat(w, unit),
            ex.dumbbellBenchPress(w, unit),
            ex.latPulldown(w, unit),
            { ...ex.romanianDeadlift(w, unit), targetSets: 2, targetReps: 10 },
            ex.plank(w, unit),
          ],
        },
        {
          id: "full-body-b",
          name: "Full Body B",
          warmup: FULL_BODY_WARMUP,
          exercises: [
            ex.legPress(w, unit),
            ex.dumbbellShoulderPress(w, unit),
            ex.seatedCableRow(w, unit),
            { ...ex.seatedLegCurl(w, unit), targetSets: 2 },
            ex.plank(w, unit),
          ],
        },
        {
          id: "full-body-c",
          name: "Full Body C",
          warmup: FULL_BODY_WARMUP,
          exercises: [
            { ...ex.hipThrust(w, unit), seedWeight: w(65, 30) },
            ex.inclineDumbbellPress(w, unit),
            ex.oneArmDumbbellRow(w, unit),
            { ...ex.bulgarianSplitSquat(w, unit), targetSets: 2, targetReps: 10, targetRPE: 7 },
            ex.hangingKneeRaise(w, unit),
          ],
        },
      ],
    };
  },
};
