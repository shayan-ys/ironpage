import type { ExerciseMeta } from "@/components/SessionClient";
import { historyIn, lastWorkAt } from "./defaults";
import { recentDoses, type ReadinessDose } from "./muscles";
import { lastExerciseNote } from "./notes";
import { programWeeks } from "./program-notes";
import type { Program, ProgramDay, Session, Unit } from "./types";

/**
 * What the overview, session and recovery pages compute from the stored
 * program and sessions before rendering. Pure, so the server pages and the
 * browser-only demo pages (`*.demo.tsx`) show the same thing from the same
 * data.
 */

/**
 * Where a session's page lives. The demo is a static export with no dynamic
 * routes, so it carries the id in the query instead.
 */
export function sessionHref(id: string): string {
  return process.env.NEXT_PUBLIC_DEMO === "1"
    ? `/session/?id=${encodeURIComponent(id)}`
    : `/session/${id}`;
}

export interface OverviewData {
  /** Day id → when that day was last trained (`lastWorkAt`). */
  lastByDay: Record<string, string>;
  doses: ReadinessDose[];
}

export function overviewData(sessions: Session[], now: number): OverviewData {
  // "Last done" is dated by the newest working set logged for that day — see
  // `lastWorkAt`. Not by the record's close (that stamps the moment you noticed
  // a session was open, dating Saturday's workout to Sunday) and not by its
  // start (that misdates any record whose training happened later: a session
  // paused overnight, or the one legacy record holding two performances).
  //
  // Sessions with no working set logged are skipped outright: a start you
  // abandoned, or one the app closed on its own after three idle days, is a
  // record of nothing and must not report the day as trained.
  const lastByDay: Record<string, string> = {};
  for (const s of sessions) {
    if (!s.finishedAt) continue;
    const at = lastWorkAt(s);
    // Max per day rather than first-match, so the answer does not depend on the
    // listing's sort order.
    if (at && (!lastByDay[s.dayId] || at > lastByDay[s.dayId])) lastByDay[s.dayId] = at;
  }
  return { lastByDay, doses: recentDoses(sessions, now) };
}

/**
 * The most recent finished-or-not session (other than this one) that actually
 * logged this exercise, reduced to its done working sets plus how hard the
 * lift was rated. This is the "last time" reference shown per exercise — kept
 * distinct from the editable current sets so applying a change to upcoming
 * sets never erases what you did before. Ramp sets are left out; the reference
 * is what you worked with, not what you warmed up with.
 */
function lastFor(
  peId: string | undefined,
  others: Session[],
): { sets: { weightLb: number; reps: number }[]; rpe?: number } | null {
  const ordered = [...others].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  for (const s of ordered) {
    const ex = s.exercises.find((e) => e.exerciseId === peId && !e.skipped);
    const done = ex?.sets.filter((x) => x.done && !x.warmup) ?? [];
    if (done.length === 0) continue;
    // The rating now lives on the exercise. Sessions logged before it moved
    // carry one score per set instead: take the hardest, which is the number
    // an exercise-level rating would have been asked for anyway.
    const perSet = done.map((x) => x.rpe).filter((r): r is number => r !== null);
    const rpe = ex?.rpe ?? (perSet.length > 0 ? Math.max(...perSet) : undefined);
    return { sets: done.map((x) => ({ weightLb: x.weightLb, reps: x.reps })), rpe: rpe ?? undefined };
  }
  return null;
}

export interface SessionProps {
  meta: Record<string, ExerciseMeta>;
  unit: Unit;
  warmup?: ProgramDay["warmup"];
}

/**
 * Everything the session screen takes besides the session itself; `all` may
 * include `session`. The warm-up is read from the current program.
 */
export function sessionProps(session: Session, program: Program | null, all: Session[]): SessionProps {
  const day = program?.days.find((d) => d.id === session.dayId);
  // A session keeps the unit it was logged in. Sessions from before units were
  // recorded take the current program's unit, or lb with no stored program.
  const unit = session.unit ?? program?.unit ?? "lb";
  const others = all.filter((s) => s.id !== session.id);
  // The reference row compares weights, so sessions logged in the other unit
  // are left out; the note below is text and still comes from any session.
  const sameUnit = historyIn(unit, others);

  const meta: Record<string, ExerciseMeta> = {};
  for (const ex of session.exercises) {
    const pe = day?.exercises.find((p) => p.id === ex.exerciseId);
    const last = lastFor(pe?.id, sameUnit);
    const lastSets = last?.sets ?? null;
    const seed = pe?.seedWeight ?? ex.sets[0]?.weightLb ?? 0;
    const guess = !lastSets;
    const source = pe?.seedIsGuess ? "estimate" : "program";
    const hint = lastSets
      ? `last · ${lastSets.map((x) => `${x.weightLb}×${x.reps}`).join(" · ")}`
      : `~${seed} ${unit} · ${source}`;
    meta[ex.exerciseId] = {
      targetRpe: pe?.targetRPE ?? 8,
      notes: pe?.notes,
      then: pe?.then,
      // Weeks as of the session's start, the moment its sets were seeded.
      weeks: (pe && programWeeks(pe, new Date(session.startedAt))) ?? undefined,
      hint,
      guess,
      lastSets: last?.sets,
      lastRpe: last?.rpe,
      lastNote: lastExerciseNote(ex.exerciseId, others, session.startedAt) ?? undefined,
    };
  }
  return { meta, unit, warmup: day?.warmup };
}

/** The recovery page's back link: only same-app paths, since `//host` would leave the app. */
export function recoveryBack(from: string | null | undefined): string {
  return from?.startsWith("/") && !from.startsWith("//") ? from : "/";
}
