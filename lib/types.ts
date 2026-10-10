/**
 * Weight unit of a program. Every weight number (`seedWeight`, `weightLb` on
 * targets, ramp sets and logged sets) is stored in `Program.unit`, with no
 * conversion. The `Lb` suffix on those field names is historical: renaming the
 * stored fields would break saved data. A session records the program's unit at
 * its start (`Session.unit`); screens still label weights with the current
 * program's.
 */
export type Unit = "lb" | "kg";

/** The 18 muscle groups a muscle score can target (left/right combined). */
export const MUSCLE_IDS = [
  "chest", "front-delts", "side-delts", "rear-delts", "lats", "upper-back",
  "traps", "biceps", "triceps", "forearms", "abs", "obliques", "lower-back",
  "glutes", "quads", "hamstrings", "calves", "tibialis",
] as const;
export type MuscleId = (typeof MUSCLE_IDS)[number];
/** Planner-judged 0–1 score per target muscle (1, .75, .5, .25). */
export type MuscleScores = Partial<Record<MuscleId, number>>;

/**
 * One row of a program note: a short free label ("Setup", "Cue", "Log") and
 * glanceable text. One point is a phrase; two or more points go one per line
 * ("\n"), and the notes sheet shows them as bullets.
 */
export interface ProgramNoteRow {
  label: string;
  text: string;
}

/** ---- Program (the plan) ---- */
export interface ProgramExercise {
  id: string;
  name: string;
  targetSets: number;
  targetReps: number;
  targetRPE: number; // 6..10
  seedWeight: number; // in Program.unit
  /**
   * Dated pre-fill floors, so a temporary drop does not become the next
   * session's default and a multi-week ladder needs no weekly program edit.
   * The latest step whose `from` is at or before the session start applies;
   * history above its optional weight still wins, and steps may override reps
   * and sets.
   */
  targets?: TargetStep[];
  /**
   * Planned ramp sets, in lifting order. Session start copies them as leading
   * `warmup: true` rows. A target step's own `rampSets` replaces this list
   * while the step applies, so ramp loads can follow a weekly ladder.
   */
  rampSets?: RampSet[];
  seedIsGuess: boolean;
  /**
   * The program note: the planner's labelled rows for the notes sheet, in
   * display order. `PUT /api/program` rejects an exercise without one.
   */
  notes?: ProgramNoteRow[];
  /** One plain sentence for how to progress once the week steps run out. */
  then?: string;
  /**
   * Rest in seconds from this exercise's working-set tick to the start of the
   * next set. Absent: its sets neither start nor end a rest (gap-fillers).
   */
  restSec?: number;
  /**
   * Adjacent exercises sharing this id form one superset, alternating in
   * program order once every member's ramp sets are done.
   */
  supersetId?: string;
  /**
   * Reps are seconds: each row's `reps` is the hold length, and the set row
   * offers a hold timer that ticks the set when it reaches zero.
   */
  timed?: boolean;
  /** Muscle scores; `PUT /api/program` rejects an exercise with none above 0. */
  muscles?: MuscleScores;
}

export interface TargetStep {
  /** ISO timestamp with offset, e.g. "2026-10-06T00:00:00+00:00". */
  from: string;
  /** Optional minimum pre-fill weight in Program.unit; absent means history or seed only. */
  weightLb?: number;
  /** Overrides targetReps for the pre-filled sets while this step applies. */
  reps?: number;
  /** Overrides targetSets while this step applies. */
  sets?: number;
  /** Replaces the exercise's `rampSets` while this step applies. */
  rampSets?: RampSet[];
}

/** One planned ramp set; `weightLb` is in Program.unit. */
export interface RampSet {
  weightLb: number;
  reps: number;
  /** Rest after this ramp set; absent means no countdown after it. */
  restSec?: number;
}

export interface ProgramDay {
  id: string;
  name: string;
  /**
   * General warm-up shown as a card at the top of the day's sessions. Sessions
   * do not copy it: the card reads the current program day, and hides when the
   * day has none.
   */
  warmup?: {
    total?: string;
    note?: string;
    drills: { name: string; dose: string; why?: string }[];
  };
  exercises: ProgramExercise[];
}

export interface Program {
  unit: Unit;
  days: ProgramDay[];
}

/** ---- Sessions (what happened) ---- */
export interface LoggedSet {
  /** In Program.unit (the `Lb` suffix is historical). */
  weightLb: number;
  reps: number;
  /**
   * Legacy: RPE used to be rated per set. It is now rated once for the whole
   * exercise (`SessionExercise.rpe`), because the programme prescribes one
   * target per exercise and a fixed load already makes effort climb across
   * sets on its own. Sessions logged before 2026-08 carry real values here and
   * must stay readable; nothing writes it any more.
   */
  rpe: number | null;
  done: boolean;
  skipped: boolean;
  doneAt?: string;
  /**
   * A ramp/warm-up set for this exercise: real load, logged like any other set,
   * but deliberately excluded from working volume (progress counts, session
   * completion, and the weights carried into the next session's defaults).
   * Absent on sets logged before ramp sets existed, so treat undefined as false.
   */
  warmup?: boolean;
  /** Planned ramp rows only: the ramp entry's `restSec`, copied at session start. */
  restSec?: number;
}

export interface SessionExercise {
  exerciseId: string;
  name: string;
  skipped: boolean;
  /** Free-text note the user attaches to this exercise (e.g. "weight per hand"). */
  note?: string;
  /**
   * How hard the exercise was, on the 6–10 RIR scale — one rating for the
   * lift, not one per set. Defaults to the programme's target the moment the
   * last working set is ticked, so a finished exercise is never unrated, and
   * clears again if every working set is un-ticked. Absent on sessions logged
   * before the rating moved up from the set.
   */
  rpe?: number | null;
  /** Snapshot of the program exercise's `restSec` at session start. */
  restSec?: number;
  /** Snapshot of the program exercise's `supersetId` at session start. */
  supersetId?: string;
  /** Snapshot of the program exercise's `timed` at session start. */
  timed?: boolean;
  /**
   * Snapshot of the program exercise's muscle scores at session start, so a
   * finished session's scores never change with later program edits (the
   * map's display scale may be retuned). Absent = unknown (older sessions).
   */
  muscles?: MuscleScores;
  sets: LoggedSet[];
}

export type SessionFeel = "spent" | "strong" | "fire";

export interface Session {
  id: string;
  dayId: string;
  dayName: string;
  startedAt: string;
  finishedAt: string | null;
  sessionFeel: SessionFeel | null;
  /**
   * When the day's general warm-up was ticked off. One checkmark for the whole
   * card — it also dates the boundary between prep and the first working set,
   * which is what makes "how long did the first lift actually take" answerable.
   * Null while pending; absent on sessions logged before the checkmark existed.
   */
  warmupDoneAt?: string | null;
  /**
   * When the lifter deliberately stepped away mid-workout ("Pause"), rather
   * than the app losing them. A paused session is still open and resumable;
   * the timestamp exists so the record can say "paused Monday 8pm" instead of
   * inferring abandonment from silence, and so a session that later times out
   * closes at the moment training actually stopped. Any later edit clears it.
   */
  pausedAt?: string | null;
  /**
   * Set when the app closed this session itself, because it sat untouched past
   * `ABANDON_AFTER_MS`. Never set by a real "Finish workout" tap, so a report
   * can tell a workout you ended from one that simply timed out.
   */
  autoClosed?: boolean;
  /**
   * The program's unit when this session started, so history logged in another
   * unit never pre-fills or labels a later session. Absent on sessions logged
   * before the field existed; readers take those to match the current program.
   */
  unit?: Unit;
  /**
   * Per-muscle impact of the finished session (muscle score × effort weight,
   * summed over completed working sets). Written by the server on every save of
   * a finished session, kept for a later recovery plan. Absent while open and on
   * sessions without muscle snapshots (unknown).
   */
  muscleImpact?: Partial<Record<MuscleId, number>>;
  exercises: SessionExercise[];
}

export interface ExportBundle {
  /** Null before a program has been chosen. */
  program: Program | null;
  sessions: Session[];
  generatedAt: string;
}
