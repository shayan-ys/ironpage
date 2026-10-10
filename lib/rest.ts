import type { LoggedSet, Session } from "./types";
import { groupExercises, isSupersetComplete, isSupersetRoundComplete } from "./supersets";

export type RestDecision =
  | { kind: "ramp" | "working" | "round"; seconds: number }
  | { kind: "handoff" | "last"; seconds: null };

export type RestOwner = {
  key: string;
  exerciseIndex: number;
  setIndex: number;
  exerciseId: string;
  doneAt: string;
  startedAt: number;
  done: boolean;
  decision: RestDecision;
};

export type RestWindow = RestOwner & { seconds: number; endsAt: number };

/** Rest meaning for one session row. Undefined means the row is not rest-relevant. */
export function restDecisionForSet(session: Session, e: number, s: number): RestDecision | undefined {
  const exercise = session.exercises[e];
  const set = exercise?.sets[s];
  if (!exercise || !set) return undefined;

  if (set.warmup) {
    return set.restSec === undefined ? undefined : { kind: "ramp", seconds: set.restSec };
  }
  if (exercise.restSec === undefined) return undefined;

  const run = groupExercises(session.exercises).find(({ start, end }) => e >= start && e <= end);
  if (run?.supersetId && run.end > run.start) {
    if (!isSupersetRoundComplete(session, e, s)) return { kind: "handoff", seconds: null };
    if (isSupersetComplete(session, e)) return { kind: "last", seconds: null };
    return { kind: "round", seconds: exercise.restSec };
  }

  const working = exercise.sets.filter((row) => !row.warmup);
  if (working.every((row) => row.done || row.skipped)) return { kind: "last", seconds: null };
  return { kind: "working", seconds: exercise.restSec };
}

/** Stable owner identity stored only on this phone when a rest is skipped. */
export function restOwnerKey(exerciseId: string, setIndex: number, doneAt: string): string {
  return `${exerciseId}:${setIndex}:${doneAt}`;
}

/** The rest-relevant row with the newest tick timestamp, whether done or not. */
export function restOwner(session: Session): RestOwner | null {
  let owner: RestOwner | null = null;
  session.exercises.forEach((exercise, e) => {
    exercise.sets.forEach((set: LoggedSet, s) => {
      if (!set.doneAt) return;
      const decision = restDecisionForSet(session, e, s);
      if (!decision) return;
      const startedAt = Date.parse(set.doneAt);
      if (!Number.isFinite(startedAt) || (owner && startedAt < owner.startedAt)) return;
      owner = {
        key: restOwnerKey(exercise.exerciseId, s, set.doneAt),
        exerciseIndex: e,
        setIndex: s,
        exerciseId: exercise.exerciseId,
        doneAt: set.doneAt,
        startedAt,
        done: set.done,
        decision,
      };
    });
  });
  return owner;
}

/** Active countdown, derived from the latest owner; an un-tick never revives an older row. */
export function restWindow(session: Session): RestWindow | null {
  if (session.finishedAt) return null;
  const owner = restOwner(session);
  if (!owner || !owner.done || owner.decision.seconds === null) return null;
  const seconds = owner.decision.seconds;
  return { ...owner, seconds, endsAt: owner.startedAt + seconds * 1000 };
}

export function restSkipStorageKey(sessionId: string, ownerKey: string): string {
  return `gym:rest-skip:${encodeURIComponent(sessionId)}:${encodeURIComponent(ownerKey)}`;
}
