import type { Session, SessionExercise } from "./types";

export type SetRef = { e: number; s: number };
export type ExerciseRun = { start: number; end: number; supersetId: string | null };

type ExerciseWithSets = Pick<SessionExercise, "supersetId" | "skipped" | "sets">;

/** Consecutive exercises with the same non-empty id form one run. */
export function groupExercises<T extends { supersetId?: string }>(exercises: readonly T[]): ExerciseRun[] {
  const runs: ExerciseRun[] = [];
  exercises.forEach((exercise, index) => {
    const supersetId = exercise.supersetId || null;
    const previous = runs[runs.length - 1];
    if (supersetId && previous?.supersetId === supersetId) previous.end = index;
    else runs.push({ start: index, end: index, supersetId });
  });
  return runs;
}


function runFor(session: Pick<Session, "exercises">, index: number): ExerciseRun | null {
  const run = groupExercises(session.exercises).find(({ start, end }) => index >= start && index <= end);
  return run?.supersetId && run.end > run.start ? run : null;
}
/** True when two exercise indexes belong to the same adjacent superset run. */
export function sameSupersetRun(session: Pick<Session, "exercises">, first: number, second: number): boolean {
  if (first === second) return false;
  const a = runFor(session, first);
  const b = runFor(session, second);
  return a !== null && b !== null && a.start === b.start;
}

function workingSets(exercise: ExerciseWithSets) {
  return exercise.sets.filter((set) => !set.warmup);
}

function settledCount(exercise: ExerciseWithSets): number {
  return workingSets(exercise).filter((set) => set.done || set.skipped).length;
}

function memberFinished(exercise: ExerciseWithSets): boolean {
  const working = workingSets(exercise);
  return exercise.skipped || (working.length > 0 && working.every((set) => set.done || set.skipped));
}

function currentInRun(session: Session, run: ExerciseRun): SetRef | null {
  if (run.supersetId === null || run.end === run.start) {
    const exercise = session.exercises[run.start];
    if (exercise.skipped) return null;
    const s = exercise.sets.findIndex((set) => !set.done && !set.skipped);
    return s < 0 ? null : { e: run.start, s };
  }

  const members: number[] = [];
  for (let e = run.start; e <= run.end; e++) {
    if (!memberFinished(session.exercises[e])) members.push(e);
  }

  // Ramp sets are preparation: finish every member's pending ramps in program order first.
  for (const e of members) {
    const s = session.exercises[e].sets.findIndex((set) => set.warmup && !set.done && !set.skipped);
    if (s >= 0) return { e, s };
  }

  // Alternate among members with work remaining; the member with fewer done working sets leads.
  let best: { e: number; s: number; done: number } | null = null;
  for (const e of members) {
    const exercise = session.exercises[e];
    const s = exercise.sets.findIndex((set) => !set.warmup && !set.done && !set.skipped);
    if (s < 0) continue;
    const done = exercise.sets.filter((set) => !set.warmup && set.done).length;
    if (!best || done < best.done) best = { e, s, done };
  }
  return best ? { e: best.e, s: best.s } : null;
}

/** The next set in the session; supersets count as one unit in exercise order. */
export function currentSet(session: Session): SetRef | null {
  for (const run of groupExercises(session.exercises)) {
    const current = currentInRun(session, run);
    if (current) return current;
  }
  return null;
}

/** 1-based round number for a working set (or null outside a superset). */
export function supersetRound(session: Session, e: number, s: number): number | null {
  const exercise = session.exercises[e];
  const set = exercise?.sets[s];
  if (!set || set.warmup || !runFor(session, e)) return null;
  return settledCount(exercise) + (set.done || set.skipped ? 0 : 1);
}

function completesRound(session: Session, run: ExerciseRun, e: number, round: number): boolean {
  for (let member = run.start; member <= run.end; member++) {
    if (member === e) continue;
    const exercise = session.exercises[member];
    if (exercise.skipped) continue;
    const working = workingSets(exercise);
    // A short or already-finished member has no set in this round.
    if (working.length < round || settledCount(exercise) >= round) continue;
    return false;
  }
  return true;
}

/** Whether a currently done working set is the one that completed its round. */
export function isSupersetRoundComplete(session: Session, e: number, s: number): boolean {
  const set = session.exercises[e]?.sets[s];
  const run = runFor(session, e);
  if (!set?.done || set.warmup || !run) return false;
  const round = supersetRound(session, e, s);
  return round !== null && completesRound(session, run, e, round);
}

/** Whether ticking this pending working set would close its superset round. */
export function tickCompletesSupersetRound(session: Session, e: number, s: number): boolean {
  const exercise = session.exercises[e];
  const set = exercise?.sets[s];
  const run = runFor(session, e);
  if (!set || set.warmup || set.done || set.skipped || exercise.skipped || !run) return false;
  const round = settledCount(exercise) + 1;
  return completesRound(session, run, e, round);
}

/** All non-skipped members have completed or skipped their working sets. */
export function isSupersetComplete(session: Session, e: number): boolean {
  const run = runFor(session, e);
  if (!run) return false;
  for (let member = run.start; member <= run.end; member++) {
    const exercise = session.exercises[member];
    if (exercise.skipped) continue;
    if (!workingSets(exercise).every((set) => set.done || set.skipped)) return false;
  }
  return true;
}
