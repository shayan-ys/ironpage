import type { ExerciseFactory } from "./shared";

/**
 * The exercises the starter programs draw from. Each factory carries a sensible
 * default scheme and a beginner seed load; programs override sets, reps, RPE
 * and seed where their style differs. Ids are stable: a lift keeps its history
 * under its id, so do not rename one that has shipped.
 *
 * Seed loads are hand-picked per unit for someone new to the lift.
 * `seedIsGuess` is false only where the start is a prescription (an empty
 * bar, bodyweight), not an estimate of the lifter.
 */

const progress = (unit: string, lb: number, kg: number, when: string) =>
  `add ${unit === "kg" ? kg : lb} ${unit} ${when}`;

export const backSquat: ExerciseFactory = (w, unit) => ({
  id: "back-squat",
  name: "Back Squat",
  targetSets: 3,
  targetReps: 5,
  targetRPE: 8,
  seedWeight: w(95, 40),
  seedIsGuess: true,
  notes: [
    { label: "Log", text: "total weight, bar included" },
    { label: "Setup", text: "bar on the upper back, not the neck\nfeet about shoulder-width, toes slightly out" },
    { label: "Cue", text: "big breath and brace before each rep\nknees follow the toes\nsit as deep as your back stays flat" },
    { label: "Safety", text: "set the rack's safety arms just below the bottom position" },
  ],
  then: progress(unit, 5, 2.5, "next session when every rep moves well"),
  restSec: 180,
  muscles: { quads: 1, glutes: 0.75, "lower-back": 0.25, abs: 0.25 },
});

export const benchPress: ExerciseFactory = (w, unit) => ({
  id: "bench-press",
  name: "Bench Press",
  targetSets: 3,
  targetReps: 5,
  targetRPE: 8,
  seedWeight: w(65, 30),
  seedIsGuess: true,
  notes: [
    { label: "Log", text: "total weight, bar included" },
    { label: "Setup", text: "eyes under the bar\nshoulder blades squeezed back and down\nfeet flat on the floor" },
    { label: "Cue", text: "lower to the middle of the chest\npress up and slightly back" },
    { label: "Safety", text: "use the safety arms or a spotter" },
  ],
  then: progress(unit, 5, 2.5, "next session when every rep moves well"),
  restSec: 150,
  muscles: { chest: 1, triceps: 0.5, "front-delts": 0.5 },
});

export const overheadPress: ExerciseFactory = (w, unit) => ({
  id: "overhead-press",
  name: "Overhead Press",
  targetSets: 3,
  targetReps: 5,
  targetRPE: 8,
  seedWeight: w(45, 20),
  seedIsGuess: false,
  notes: [
    { label: "Log", text: "total weight, bar included · start with the empty bar" },
    { label: "Setup", text: "standing, hands just outside the shoulders\nbar resting on the front of the shoulders" },
    { label: "Cue", text: "squeeze glutes, ribs down\nmove the head back, then through once the bar passes" },
  ],
  then: progress(unit, 5, 2.5, "when every rep moves well; smaller jumps are fine here"),
  restSec: 150,
  muscles: { "front-delts": 1, triceps: 0.5, "side-delts": 0.25, "upper-back": 0.25 },
});

export const barbellRow: ExerciseFactory = (w, unit) => ({
  id: "barbell-row",
  name: "Barbell Row",
  targetSets: 3,
  targetReps: 8,
  targetRPE: 8,
  seedWeight: w(65, 30),
  seedIsGuess: true,
  notes: [
    { label: "Log", text: "total weight, bar included" },
    { label: "Setup", text: "hinge until the torso is about 45°\nbar hangs below the shoulders" },
    { label: "Cue", text: "pull to the lower ribs\nback stays flat, no heaving" },
    { label: "Swap", text: "chest-supported row if the lower back tires first" },
  ],
  then: progress(unit, 5, 2.5, "when all reps are clean"),
  restSec: 120,
  muscles: { "upper-back": 1, lats: 0.75, "rear-delts": 0.5, biceps: 0.5, "lower-back": 0.25 },
});

export const deadlift: ExerciseFactory = (w, unit) => ({
  id: "deadlift",
  name: "Deadlift",
  targetSets: 1,
  targetReps: 5,
  targetRPE: 8,
  seedWeight: w(135, 60),
  seedIsGuess: true,
  notes: [
    { label: "Log", text: "total weight, bar included" },
    { label: "Setup", text: "bar over the middle of the foot\nshins touch the bar, hips between squat and hinge" },
    { label: "Cue", text: "pull the slack out of the bar first\npush the floor away\nstand tall, do not lean back" },
    { label: "Stop", text: "if your lower back rounds, the set is over" },
  ],
  then: progress(unit, 10, 5, "next session while the back stays flat"),
  restSec: 180,
  muscles: { glutes: 1, hamstrings: 0.75, "lower-back": 0.75, quads: 0.5, traps: 0.5, forearms: 0.5 },
});

export const romanianDeadlift: ExerciseFactory = (w, unit) => ({
  id: "romanian-deadlift",
  name: "Romanian Deadlift",
  targetSets: 3,
  targetReps: 8,
  targetRPE: 7,
  seedWeight: w(65, 30),
  seedIsGuess: true,
  notes: [
    { label: "Log", text: "total weight, bar included" },
    { label: "Cue", text: "soft knees, push the hips back\nbar slides down the thighs\nstop when the hamstrings are tight" },
    { label: "Tempo", text: "2 s down" },
  ],
  then: progress(unit, 5, 2.5, "when all reps are clean"),
  restSec: 120,
  muscles: { hamstrings: 1, glutes: 0.75, "lower-back": 0.5 },
});

export const gobletSquat: ExerciseFactory = (w, unit) => ({
  id: "goblet-squat",
  name: "Goblet Squat",
  targetSets: 3,
  targetReps: 10,
  targetRPE: 7,
  seedWeight: w(25, 12),
  seedIsGuess: true,
  notes: [
    { label: "Log", text: "one dumbbell, held at the chest" },
    { label: "Cue", text: "elbows inside the knees at the bottom\nchest up, heels down" },
  ],
  then: progress(unit, 5, 2, "when all sets of 10 feel smooth"),
  restSec: 90,
  muscles: { quads: 1, glutes: 0.75, abs: 0.25 },
});

export const legPress: ExerciseFactory = (w, unit) => ({
  id: "leg-press",
  name: "Leg Press",
  targetSets: 3,
  targetReps: 10,
  targetRPE: 8,
  seedWeight: w(140, 60),
  seedIsGuess: true,
  notes: [
    { label: "Log", text: "plates added, or the stack number" },
    { label: "Setup", text: "feet mid-platform, shoulder-width" },
    { label: "Cue", text: "lower until the hips start to lift, then stop\ndo not lock the knees hard" },
  ],
  then: progress(unit, 10, 5, "when all reps are clean"),
  restSec: 120,
  muscles: { quads: 1, glutes: 0.5 },
});

export const dumbbellBenchPress: ExerciseFactory = (w, unit) => ({
  id: "dumbbell-bench-press",
  name: "Dumbbell Bench Press",
  targetSets: 3,
  targetReps: 10,
  targetRPE: 7,
  seedWeight: w(25, 10),
  seedIsGuess: true,
  notes: [
    { label: "Log", text: "per hand" },
    { label: "Setup", text: "kick the dumbbells up from the knees\nshoulder blades back and down" },
    { label: "Cue", text: "elbows about 45° from the body\nlower until the dumbbells reach chest height" },
  ],
  then: progress(unit, 5, 2, "a hand when all sets of 10 feel smooth"),
  restSec: 90,
  muscles: { chest: 1, triceps: 0.5, "front-delts": 0.5 },
});

export const inclineDumbbellPress: ExerciseFactory = (w, unit) => ({
  id: "incline-dumbbell-press",
  name: "Incline Dumbbell Press",
  targetSets: 3,
  targetReps: 10,
  targetRPE: 8,
  seedWeight: w(25, 10),
  seedIsGuess: true,
  notes: [
    { label: "Log", text: "per hand" },
    { label: "Setup", text: "bench at 30°, low incline" },
    { label: "Cue", text: "press up and slightly in\nslow on the way down" },
  ],
  then: progress(unit, 5, 2, "a hand when all reps are clean"),
  restSec: 90,
  muscles: { chest: 0.75, "front-delts": 0.75, triceps: 0.5 },
});

export const dumbbellShoulderPress: ExerciseFactory = (w, unit) => ({
  id: "dumbbell-shoulder-press",
  name: "Seated Dumbbell Shoulder Press",
  targetSets: 3,
  targetReps: 10,
  targetRPE: 8,
  seedWeight: w(20, 8),
  seedIsGuess: true,
  notes: [
    { label: "Log", text: "per hand" },
    { label: "Setup", text: "bench upright, back flat against it" },
    { label: "Cue", text: "press up without arching\nlower to ear height" },
  ],
  then: progress(unit, 5, 2, "a hand when all reps are clean"),
  restSec: 90,
  muscles: { "front-delts": 1, "side-delts": 0.5, triceps: 0.5 },
});

export const latPulldown: ExerciseFactory = (w, unit) => ({
  id: "lat-pulldown",
  name: "Lat Pulldown",
  targetSets: 3,
  targetReps: 10,
  targetRPE: 8,
  seedWeight: w(70, 30),
  seedIsGuess: true,
  notes: [
    { label: "Log", text: "stack number" },
    { label: "Setup", text: "thigh pad snug\nhands just outside the shoulders" },
    { label: "Cue", text: "shoulders down first, then pull to the upper chest\ncontrol it back up" },
  ],
  then: progress(unit, 10, 5, "when all reps are clean"),
  restSec: 90,
  muscles: { lats: 1, "upper-back": 0.5, biceps: 0.5 },
});

export const seatedCableRow: ExerciseFactory = (w, unit) => ({
  id: "seated-cable-row",
  name: "Seated Cable Row",
  targetSets: 3,
  targetReps: 10,
  targetRPE: 8,
  seedWeight: w(70, 30),
  seedIsGuess: true,
  notes: [
    { label: "Log", text: "stack number" },
    { label: "Cue", text: "sit tall, pull to the belly button\nsqueeze the shoulder blades\nno rocking" },
  ],
  then: progress(unit, 10, 5, "when all reps are clean"),
  restSec: 90,
  muscles: { "upper-back": 1, lats: 0.75, "rear-delts": 0.5, biceps: 0.5 },
});

export const oneArmDumbbellRow: ExerciseFactory = (w, unit) => ({
  id: "one-arm-dumbbell-row",
  name: "One-Arm Dumbbell Row",
  targetSets: 3,
  targetReps: 10,
  targetRPE: 8,
  seedWeight: w(30, 12),
  seedIsGuess: true,
  notes: [
    { label: "Log", text: "per hand · per side" },
    { label: "Setup", text: "hand and knee on a bench, back flat" },
    { label: "Cue", text: "pull the elbow to the hip\npause at the top" },
  ],
  then: progress(unit, 5, 2, "when all reps are clean"),
  restSec: 60,
  muscles: { lats: 1, "upper-back": 0.75, biceps: 0.5 },
});

export const chinUp: ExerciseFactory = () => ({
  id: "chin-up",
  name: "Chin-Up",
  targetSets: 3,
  targetReps: 6,
  targetRPE: 8,
  seedWeight: 0,
  seedIsGuess: false,
  notes: [
    { label: "Log", text: "added weight · 0 = bodyweight" },
    { label: "Cue", text: "palms facing you\nfrom a dead hang to chin over the bar" },
    { label: "Swap", text: "band-assisted chin-up or lat pulldown if 6 are out of reach" },
  ],
  then: "add a rep a set each week; once 3 × 10 is easy, add weight",
  restSec: 120,
  muscles: { lats: 1, biceps: 0.75, "upper-back": 0.5 },
});

export const seatedLegCurl: ExerciseFactory = (w, unit) => ({
  id: "seated-leg-curl",
  name: "Seated Leg Curl",
  targetSets: 3,
  targetReps: 12,
  targetRPE: 9,
  seedWeight: w(50, 20),
  seedIsGuess: true,
  notes: [
    { label: "Log", text: "stack number" },
    { label: "Setup", text: "knee in line with the machine's pivot\npad just above the heels" },
    { label: "Tempo", text: "1 s squeeze, 2 s back" },
  ],
  then: progress(unit, 10, 5, "when all reps are clean"),
  restSec: 60,
  muscles: { hamstrings: 1 },
});

export const legExtension: ExerciseFactory = (w, unit) => ({
  id: "leg-extension",
  name: "Leg Extension",
  targetSets: 3,
  targetReps: 12,
  targetRPE: 9,
  seedWeight: w(50, 20),
  seedIsGuess: true,
  notes: [
    { label: "Log", text: "stack number" },
    { label: "Setup", text: "knee in line with the machine's pivot" },
    { label: "Tempo", text: "1 s pause at the top, 2 s down" },
  ],
  then: progress(unit, 10, 5, "when all reps are clean"),
  restSec: 60,
  muscles: { quads: 1 },
});

export const standingCalfRaise: ExerciseFactory = (w, unit) => ({
  id: "standing-calf-raise",
  name: "Standing Calf Raise",
  targetSets: 3,
  targetReps: 12,
  targetRPE: 9,
  seedWeight: w(90, 40),
  seedIsGuess: true,
  notes: [
    { label: "Log", text: "stack number, or plates on a Smith bar" },
    { label: "Tempo", text: "full stretch at the bottom with a 1 s pause\nall the way up" },
  ],
  then: progress(unit, 10, 5, "when all reps are clean"),
  restSec: 60,
  muscles: { calves: 1 },
});

export const hipThrust: ExerciseFactory = (w, unit) => ({
  id: "hip-thrust",
  name: "Barbell Hip Thrust",
  targetSets: 3,
  targetReps: 10,
  targetRPE: 8,
  seedWeight: w(95, 40),
  seedIsGuess: true,
  notes: [
    { label: "Log", text: "total weight, bar included" },
    { label: "Setup", text: "shoulder blades on the bench edge\npad over the hips" },
    { label: "Cue", text: "chin tucked, ribs down\ndrive through the heels\n1 s squeeze at the top" },
  ],
  then: progress(unit, 10, 5, "when all reps are clean"),
  restSec: 90,
  muscles: { glutes: 1, hamstrings: 0.25 },
});

export const bulgarianSplitSquat: ExerciseFactory = (w, unit) => ({
  id: "bulgarian-split-squat",
  name: "Bulgarian Split Squat",
  targetSets: 3,
  targetReps: 8,
  targetRPE: 8,
  seedWeight: w(15, 6),
  seedIsGuess: true,
  notes: [
    { label: "Log", text: "per hand · reps per leg" },
    { label: "Setup", text: "rear foot on a bench\nfront foot far enough forward that the heel stays down" },
    { label: "Cue", text: "back knee straight down\ndrive through the front heel" },
  ],
  then: progress(unit, 5, 2, "a hand when all reps are clean"),
  restSec: 90,
  muscles: { glutes: 1, quads: 0.75 },
});

export const lateralRaise: ExerciseFactory = (w, unit) => ({
  id: "lateral-raise",
  name: "Dumbbell Lateral Raise",
  targetSets: 3,
  targetReps: 15,
  targetRPE: 9,
  seedWeight: w(10, 4),
  seedIsGuess: true,
  notes: [
    { label: "Log", text: "per hand" },
    { label: "Cue", text: "lead with the elbows\nstop at shoulder height\nno swinging" },
  ],
  then: progress(unit, 5, 2, "a hand once 3 × 15 is clean"),
  restSec: 60,
  muscles: { "side-delts": 1 },
});

export const facePull: ExerciseFactory = (w, unit) => ({
  id: "face-pull",
  name: "Cable Face Pull",
  targetSets: 3,
  targetReps: 15,
  targetRPE: 8,
  seedWeight: w(30, 12),
  seedIsGuess: true,
  notes: [
    { label: "Log", text: "stack number" },
    { label: "Setup", text: "rope at forehead height" },
    { label: "Cue", text: "pull to the eyes, elbows high\nrotate the fists back at the end" },
  ],
  then: progress(unit, 5, 2.5, "when all reps are clean"),
  restSec: 60,
  muscles: { "rear-delts": 1, "upper-back": 0.5, traps: 0.25 },
});

export const dumbbellCurl: ExerciseFactory = (w, unit) => ({
  id: "dumbbell-curl",
  name: "Dumbbell Curl",
  targetSets: 3,
  targetReps: 12,
  targetRPE: 9,
  seedWeight: w(20, 8),
  seedIsGuess: true,
  notes: [
    { label: "Log", text: "per hand" },
    { label: "Cue", text: "elbows stay at your sides\nslow on the way down" },
  ],
  then: progress(unit, 5, 2, "a hand when all reps are clean"),
  restSec: 60,
  muscles: { biceps: 1, forearms: 0.25 },
});

export const hammerCurl: ExerciseFactory = (w, unit) => ({
  id: "hammer-curl",
  name: "Hammer Curl",
  targetSets: 2,
  targetReps: 12,
  targetRPE: 9,
  seedWeight: w(20, 8),
  seedIsGuess: true,
  notes: [
    { label: "Log", text: "per hand" },
    { label: "Cue", text: "thumbs up the whole way\nno swinging" },
  ],
  then: progress(unit, 5, 2, "a hand when all reps are clean"),
  restSec: 60,
  muscles: { biceps: 0.75, forearms: 0.75 },
});

export const tricepsPushdown: ExerciseFactory = (w, unit) => ({
  id: "triceps-pushdown",
  name: "Cable Triceps Pushdown",
  targetSets: 3,
  targetReps: 12,
  targetRPE: 9,
  seedWeight: w(40, 18),
  seedIsGuess: true,
  notes: [
    { label: "Log", text: "stack number" },
    { label: "Cue", text: "elbows pinned to your sides\nfull lockout, slow return" },
  ],
  then: progress(unit, 5, 2.5, "when all reps are clean"),
  restSec: 60,
  muscles: { triceps: 1 },
});

export const plank: ExerciseFactory = () => ({
  id: "plank",
  name: "Plank",
  targetSets: 3,
  targetReps: 30,
  targetRPE: 8,
  seedWeight: 0,
  seedIsGuess: false,
  timed: true,
  notes: [
    { label: "Log", text: "reps are seconds held · ▶ runs the timer" },
    { label: "Cue", text: "elbows under the shoulders\nsqueeze glutes, ribs down\nstraight line from head to heels" },
  ],
  then: "add 10 s once every hold is solid, up to 60 s",
  restSec: 60,
  muscles: { abs: 1, obliques: 0.5 },
});

export const hangingKneeRaise: ExerciseFactory = () => ({
  id: "hanging-knee-raise",
  name: "Hanging Knee Raise",
  targetSets: 3,
  targetReps: 10,
  targetRPE: 8,
  seedWeight: 0,
  seedIsGuess: false,
  notes: [
    { label: "Log", text: "bodyweight · 0" },
    { label: "Cue", text: "curl the pelvis up, do not just lift the knees\nno swinging" },
    { label: "Swap", text: "captain's chair knee raise" },
  ],
  then: "add reps up to 15, then move to straight-leg raises",
  restSec: 60,
  muscles: { abs: 1, forearms: 0.25 },
});
