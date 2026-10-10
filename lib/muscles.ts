import { lastWorkAt } from "./defaults";
import { MUSCLE_IDS, type MuscleId, type ProgramDay, type Session } from "./types";

export const MUSCLE_LABELS: Record<MuscleId, string> = {
  chest: "Chest",
  "front-delts": "Front delts",
  "side-delts": "Side delts",
  "rear-delts": "Rear delts",
  lats: "Lats",
  "upper-back": "Upper back",
  traps: "Traps",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  abs: "Abs",
  obliques: "Obliques",
  "lower-back": "Lower back",
  glutes: "Glutes",
  quads: "Quads",
  hamstrings: "Hamstrings",
  calves: "Calves",
  tibialis: "Tibialis",
};

export interface MuscleImpact {
  muscle: MuscleId;
  label: string;
  impact: number;
  level: number;
}

export interface SessionMuscleImpact {
  ranked: MuscleImpact[];
}

export type MuscleImpactTotals = Partial<Record<MuscleId, number>>;

/**
 * Effort weight by exercise RPE: a set close to failure trains more than an
 * easy one, whatever the target was. Ratings are whole stops from 6 to 10.
 */
const EFFORT_WEIGHTS: Record<number, number> = { 6: 0.5, 7: 0.7, 8: 0.85, 9: 1, 10: 1 };
/** A partly done exercise has no rating yet; count it as RPE 8. */
const UNRATED_RPE = 8;

export function effortWeight(rpe: number | null | undefined): number {
  const stop = rpe == null || !Number.isFinite(rpe) ? UNRATED_RPE : Math.min(10, Math.max(6, Math.round(rpe)));
  return EFFORT_WEIGHTS[stop];
}

/**
 * Fixed heat scale, not relative to the session's top muscle: each level spans
 * 2 impact units and level 5 starts at 8 (about eight hard sets on one muscle).
 */
const LEVEL_STEP = 2;

export function impactLevel(impact: number): number {
  return Math.min(5, Math.floor(impact / LEVEL_STEP) + 1);
}

/**
 * Actual session impact: each completed working row contributes its exercise's
 * snapshotted score times the exercise's effort weight. Ramp, skipped, and
 * unticked rows do not count; an exercise-level skip does not erase rows that
 * were already completed. `null` means this session has no muscle snapshots and
 * is therefore unknown.
 */
export function muscleImpactTotals(session: Session): MuscleImpactTotals | null {
  const totals: MuscleImpactTotals = {};
  let hasSnapshot = false;

  for (const exercise of session.exercises) {
    if (exercise.muscles !== undefined) hasSnapshot = true;
    const completedSets = exercise.sets.filter((set) => set.done && !set.skipped && !set.warmup).length;
    if (completedSets === 0 || !exercise.muscles) continue;
    const weightedSets = completedSets * effortWeight(exercise.rpe);

    for (const [muscle, score] of Object.entries(exercise.muscles)) {
      if (!isMuscleId(muscle) || !Number.isFinite(score) || score <= 0) continue;
      totals[muscle] = (totals[muscle] ?? 0) + score * weightedSets;
    }
  }

  if (!hasSnapshot) return null;
  for (const muscle of Object.keys(totals) as MuscleId[]) {
    totals[muscle] = Math.round(totals[muscle]! * 1000) / 1000;
  }
  return totals;
}

export function summarizeMuscleImpact(session: Session): SessionMuscleImpact | null {
  const totals = muscleImpactTotals(session);
  if (!totals) return null;
  const ranked = MUSCLE_IDS
    .filter((muscle) => (totals[muscle] ?? 0) > 0)
    .map((muscle) => {
      const impact = totals[muscle]!;
      return { muscle, label: MUSCLE_LABELS[muscle], impact, level: impactLevel(impact) };
    })
    .sort((a, b) => b.impact - a.impact || MUSCLE_IDS.indexOf(a.muscle) - MUSCLE_IDS.indexOf(b.muscle));

  return { ranked };
}

/**
 * The stored copy of a session: a finished session carries its per-muscle
 * impact so later readers (a recovery plan) need not recompute it. Computed on
 * every server write, so edits after finishing and timeouts keep it current.
 */
export function withStoredMuscleImpact(session: Session): Session {
  const totals = session.finishedAt ? muscleImpactTotals(session) : null;
  if (totals) return { ...session, muscleImpact: totals };
  const rest = { ...session };
  delete rest.muscleImpact;
  return rest;
}

/* ------------------------------ Readiness ------------------------------ */

/**
 * Recovery half-life, the same for every muscle: about 60 h to 90% recovered
 * after eight hard sets. The evidence supports 48–72 h in general and shows no
 * reliable difference between muscles. The half-life is a judged constant.
 */
export const RECOVERY_HALF_LIFE_H = 18;
/** Fatigue that reads as 0% ready: where the session heat map reaches level 5. */
const READINESS_CAP = LEVEL_STEP * 4;
/** At or below this remaining fatigue a muscle counts as ready (90% or more). */
const READY_FATIGUE = READINESS_CAP * 0.1;
/** Older sessions add less than 0.2% of their impact; they are ignored. */
export const RECOVERY_WINDOW_MS = 7 * 24 * 3_600_000;
/** A day "targets" a muscle that one of its exercises scores at least this. */
const DAY_TARGET_SCORE = 0.75;

/** One finished session's contribution to readiness. */
export interface ReadinessDose {
  id: string;
  /** The session's newest working set (`lastWorkAt`): when the training happened. */
  trainedAt: string;
  impact: MuscleImpactTotals;
}

export interface MuscleReadiness {
  /** Remaining fatigue in impact units, on the session heat map's scale. */
  fatigue: number;
  /** 0–100, floored. */
  readiness: number;
  /** Heat level 1–5 of the remaining fatigue; 0 when the muscle is ready. */
  level: number;
}

export type ReadinessMap = Record<MuscleId, MuscleReadiness>;

/**
 * The dose a finished session adds, dated by its newest working set, not by
 * `finishedAt`: a workout closed hours later (left open, paused overnight,
 * timed out after three days) must not read as freshly trained. Uses the
 * stored `muscleImpact` when `stored` is true (server records) and recomputes
 * otherwise: a device copy edited offline after finishing still carries the
 * server's old value. `null` for open sessions, sessions without a working set,
 * and sessions without muscle snapshots, which are unknown, not zero.
 */
export function readinessDose(session: Session, stored = true): ReadinessDose | null {
  if (!session.finishedAt) return null;
  const trainedAt = lastWorkAt(session);
  if (!trainedAt) return null;
  const impact = (stored ? session.muscleImpact : undefined) ?? muscleImpactTotals(session);
  return impact ? { id: session.id, trainedAt, impact } : null;
}

/** Doses of sessions trained within the recovery window before `now`. */
export function recentDoses(sessions: Session[], now: number): ReadinessDose[] {
  return sessions.flatMap((session) => {
    const dose = readinessDose(session);
    return dose && inWindow(dose, now) ? [dose] : [];
  });
}

function inWindow(dose: ReadinessDose, now: number): boolean {
  const age = now - Date.parse(dose.trainedAt);
  return age >= 0 && age <= RECOVERY_WINDOW_MS;
}

/**
 * Per-muscle readiness at `now`. Each dose decays by half every
 * `RECOVERY_HALF_LIFE_H` from its last working set, and doses add up. Fatigue
 * reaching `READINESS_CAP` reads 0%. Doses that share an id count once (the
 * last one wins), so a device's newer copy can replace the server's. `null`
 * when no dose falls in the window: no recent data, not "fully ready".
 */
export function muscleReadiness(doses: ReadinessDose[], now: number): ReadinessMap | null {
  const byId = new Map(doses.filter((dose) => inWindow(dose, now)).map((dose) => [dose.id, dose]));
  if (byId.size === 0) return null;

  const fatigue = Object.fromEntries(MUSCLE_IDS.map((m) => [m, 0])) as Record<MuscleId, number>;
  for (const dose of byId.values()) {
    const hours = (now - Date.parse(dose.trainedAt)) / 3_600_000;
    const decay = 2 ** (-hours / RECOVERY_HALF_LIFE_H);
    for (const [muscle, impact] of Object.entries(dose.impact)) {
      if (isMuscleId(muscle) && Number.isFinite(impact) && impact! > 0) fatigue[muscle] += impact! * decay;
    }
  }

  return Object.fromEntries(
    MUSCLE_IDS.map((m) => {
      const f = fatigue[m];
      return [
        m,
        {
          fatigue: f,
          // Floored, so anything still coloured reads 89% or less, never "90%".
          readiness: Math.floor(100 * (1 - Math.min(f, READINESS_CAP) / READINESS_CAP)),
          level: f <= READY_FATIGUE ? 0 : impactLevel(f),
        },
      ];
    }),
  ) as ReadinessMap;
}

/**
 * The day card's line: up to two least-ready targets below 90%, or "Muscles
 * ready". A day targets a muscle that any of its exercises scores 0.75 or
 * more. `null` with no recent data or a day without scored targets.
 */
export function dayReadinessHint(day: ProgramDay, readiness: ReadinessMap | null): string | null {
  if (!readiness) return null;
  const targets = MUSCLE_IDS.filter((m) =>
    day.exercises.some((e) => (e.muscles?.[m] ?? 0) >= DAY_TARGET_SCORE),
  );
  if (targets.length === 0) return null;
  const tired = targets
    .filter((m) => readiness[m].level > 0)
    .sort((a, b) => readiness[a].readiness - readiness[b].readiness)
    .slice(0, 2);
  if (tired.length === 0) return "Muscles ready";
  return tired.map((m) => `${MUSCLE_LABELS[m]} ${readiness[m].readiness}%`).join(" · ");
}

function isMuscleId(value: string): value is MuscleId {
  return (MUSCLE_IDS as readonly string[]).includes(value);
}
