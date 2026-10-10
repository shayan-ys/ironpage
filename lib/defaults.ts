import type {
  LoggedSet,
  ProgramDay,
  ProgramExercise,
  Session,
  SessionExercise,
  TargetStep,
  Unit,
} from "./types";

/**
 * The past sessions whose weights mean anything in `unit`. A session without a
 * stored unit predates the field and is taken to match the current program;
 * one logged in the other unit is left out, so 160 lb never pre-fills or
 * labels 160 kg after the program switches units.
 */
export function historyIn(unit: Unit, sessions: Session[]): Session[] {
  return sessions.filter((s) => (s.unit ?? unit) === unit);
}

/**
 * Weights from the most recent session that actually logged this exercise
 * (any done or skipped-but-weighted set). Returns per-set weights, newest
 * matching session wins. null => no history, caller falls back to seedWeight.
 *
 * Ramp sets are skipped: they're deliberately submaximal, so letting a 50%
 * warm-up seed the next session's working weight would ratchet the programme
 * downward every time you used one.
 */
export function lastWeightsFor(exerciseId: string, pastSessions: Session[]): number[] | null {
  const ordered = [...pastSessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  for (const s of ordered) {
    const ex = s.exercises.find((e) => e.exerciseId === exerciseId && !e.skipped);
    const weights = ex?.sets.filter((set) => set.done && !set.warmup).map((set) => set.weightLb) ?? [];
    if (weights.length > 0) return weights;
  }
  return null;
}

/** The latest valid target step starting at or before `at`, else null. */
export function activeTarget(pe: ProgramExercise, at: Date): TargetStep | null {
  let best: TargetStep | null = null;
  let bestFrom = -Infinity;
  for (const step of pe.targets ?? []) {
    const from = Date.parse(step.from);
    if (!Number.isFinite(from) || from > at.getTime()) continue;
    if (step.weightLb !== undefined && (!Number.isFinite(step.weightLb) || step.weightLb < 0)) continue;
    if (step.sets !== undefined && (!Number.isInteger(step.sets) || step.sets <= 0)) continue;
    if (from >= bestFrom) {
      best = step;
      bestFrom = from;
    }
  }
  return best;
}

/** Default weight: history, floored by the active target; otherwise the seed. */
function defaultWeight(
  pe: ProgramExercise,
  target: TargetStep | null,
  history: number[] | null,
  setIndex: number,
): number {
  const historyWeight =
    history && history.length > 0 ? history[Math.min(setIndex, history.length - 1)] : null;
  if (typeof target?.weightLb === "number") {
    return historyWeight === null
      ? target.weightLb
      : Math.max(historyWeight, target.weightLb);
  }
  return historyWeight ?? pe.seedWeight;
}

function blankSet(reps: number, weight: number): LoggedSet {
  return { weightLb: weight, reps, rpe: null, done: false, skipped: false };
}

/**
 * Instantiate a fresh session's exercises from a program day + history.
 * Planned ramp sets lead each exercise's rows; working sets follow.
 */
export function buildSessionExercises(
  day: ProgramDay,
  pastSessions: Session[],
  at: Date = new Date(),
): SessionExercise[] {
  return day.exercises.map((pe) => {
    const history = lastWeightsFor(pe.id, pastSessions);
    const target = activeTarget(pe, at);
    const reps = target?.reps ?? pe.targetReps;
    const working = Array.from({ length: target?.sets ?? pe.targetSets }, (_, i) =>
      blankSet(reps, defaultWeight(pe, target, history, i)),
    );
    // Planned ramp sets lead; an active step's list replaces the exercise's.
    const ramps = (target?.rampSets ?? pe.rampSets ?? [])
      .filter((r) => Number.isFinite(r.weightLb) && r.weightLb >= 0 && Number.isInteger(r.reps) && r.reps > 0)
      .map((r) => ({
        ...blankSet(r.reps, r.weightLb),
        warmup: true,
        ...(r.restSec != null ? { restSec: r.restSec } : {}),
      }));
    const sets = [...ramps, ...working];
    return {
      exerciseId: pe.id,
      name: pe.name,
      skipped: false,
      ...(pe.restSec != null ? { restSec: pe.restSec } : {}),
      ...(pe.supersetId ? { supersetId: pe.supersetId } : {}),
      ...(pe.timed ? { timed: true } : {}),
      ...(pe.muscles ? { muscles: { ...pe.muscles } } : {}),
      sets,
    };
  });
}

/**
 * A fresh open session of `day`, started at `at` in the program's `unit`. The
 * id is the start time with `:` and `.` replaced, which is also its storage
 * key. Only history logged in `unit` seeds its weights.
 */
export function newSession(
  day: ProgramDay,
  pastSessions: Session[],
  unit: Unit,
  at: Date = new Date(),
): Session {
  return {
    id: at.toISOString().replace(/[:.]/g, "-"),
    dayId: day.id,
    dayName: day.name,
    startedAt: at.toISOString(),
    finishedAt: null,
    sessionFeel: null,
    warmupDoneAt: null,
    unit,
    exercises: buildSessionExercises(day, historyIn(unit, pastSessions), at),
  };
}

/**
 * When this session last saw real activity: the newest logged set, the general
 * warm-up tick, or an explicit pause — whichever is latest — falling back to
 * the start time if nothing ever happened.
 *
 * Use this to close out an *abandoned* session. Stamping `finishedAt = now` at
 * the moment you belatedly notice one was left open records when you noticed,
 * not when you trained: it back-dates the workout to the wrong day and inflates
 * its duration for anything measuring it (one real case turned a 66-minute
 * session into a 16-hour one). A genuine "Finish workout" tap still stamps now,
 * which is correct — you're there.
 */
export function lastActivityAt(session: Session): string {
  let latest = session.startedAt;
  // ISO-8601 UTC strings sort lexicographically, so plain > is a time test.
  const bump = (t: string | null | undefined) => {
    if (t && t > latest) latest = t;
  };
  bump(session.warmupDoneAt);
  // A pause is activity: it is the last moment you were provably at the gym.
  bump(session.pausedAt);
  for (const ex of session.exercises) {
    for (const set of ex.sets) bump(set.doneAt);
  }
  return latest;
}

export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * How long a paused session stays resumable. Past this the app closes it out
 * on its own (`reapAbandoned`) and the day starts from scratch next time: three
 * days of silence means the workout ended, whatever the record says. Measured
 * from the last activity, so a session paused overnight and finished the next
 * morning is never touched.
 */
export const ABANDON_AFTER_MS = 3 * STALE_AFTER_MS;

/** Time since anything happened in this session. */
export function idleMs(session: Session): number {
  return Date.now() - new Date(lastActivityAt(session)).getTime();
}

/**
 * No real activity for over a day. A stale open session is not a workout in
 * progress: resuming it silently is how two performances of the same day once
 * collapsed into one record. It is still resumable, but only through an
 * explicit prompt. Measured from the last logged set, not the start time, so a
 * long session never counts as stale while it is actually being lifted.
 */
export function isStale(session: Session): boolean {
  return idleMs(session) > STALE_AFTER_MS;
}

/** Idle past `ABANDON_AFTER_MS`: the app closes this one itself. */
export function isAbandoned(session: Session): boolean {
  return idleMs(session) > ABANDON_AFTER_MS;
}

/** Time left before an open session is closed out automatically. */
export function msUntilAbandon(session: Session): number {
  return Math.max(0, ABANDON_AFTER_MS - idleMs(session));
}

/**
 * When this day was last actually trained: the newest working set's timestamp.
 * `null` means nothing was lifted at all — working volume only, so a ramp set is
 * prep and a skipped exercise's rows do not count. A start you walked away from
 * with nothing ticked is a record, not a workout, and must never claim the day
 * on the overview no matter how it was closed.
 *
 * This — not `startedAt` and emphatically not `finishedAt` — is what dates "last
 * done". All three agree for a session lifted and finished in one sitting. They
 * diverge exactly where the label matters: `finishedAt` records when you noticed
 * a session was still open, and `startedAt` misdates any record whose training
 * happened later, which is what a session paused overnight looks like — and what
 * one legacy record that merged two performances still looks like in production.
 *
 * Sets logged before `doneAt` existed fall back to the session's start, so an
 * old workout still dates the day instead of vanishing from it.
 */
export function lastWorkAt(session: Session): string | null {
  let latest: string | null = null;
  let lifted = false;
  for (const ex of session.exercises) {
    if (ex.skipped) continue;
    for (const st of ex.sets) {
      if (!st.done || st.warmup) continue;
      lifted = true;
      // ISO-8601 UTC strings sort lexicographically, so plain > is a time test.
      if (st.doneAt && (latest === null || st.doneAt > latest)) latest = st.doneAt;
    }
  }
  if (!lifted) return null;
  return latest ?? session.startedAt;
}

/**
 * The close-out writes owed for a batch of sessions: every open one that has
 * been idle too long. Each is dated by its last activity, gets no session feel
 * (nobody was asked) and is flagged `autoClosed`, so the record shows plainly
 * that the app made this call and not the lifter. Pure so the rule is testable
 * without a store; the caller persists whatever comes back.
 */
export function reapAbandoned(sessions: Session[]): Session[] {
  return sessions
    .filter((s) => s.finishedAt === null && isAbandoned(s))
    .map((s) => ({
      ...s,
      finishedAt: lastActivityAt(s),
      sessionFeel: null,
      pausedAt: null,
      autoClosed: true,
    }));
}

/**
 * Resolve a client PATCH against what the server already holds. Set data from
 * the client always wins — that device was the one in the gym, and the server
 * never merges sets.
 *
 * The *closure* decision does not. A write queued offline must never reopen a
 * session the server has already closed, whether by a real finish, a
 * stale-session close, or the abandon reaper: that reopen is exactly how a
 * finished workout came back as "Resume", and it is now reachable a second way
 * — a phone that stayed offline for days still holds an open copy of a session
 * the server has since timed out. Keep the closure, take the sets.
 */
export function resolveIncoming(existing: Session, incoming: Session): Session {
  if (existing.finishedAt && !incoming.finishedAt) {
    return {
      ...incoming,
      finishedAt: existing.finishedAt,
      sessionFeel: existing.sessionFeel,
      // Closed sessions are not paused, and the flag stays with the close that
      // actually happened.
      pausedAt: null,
      autoClosed: existing.autoClosed,
    };
  }
  return incoming;
}
