import type { Program, Session, SessionFeel } from "../types";
import { newSession } from "../defaults";
import { currentSet } from "../supersets";
import { STARTER_PROGRAMS } from "../starter-programs";

/**
 * The demo's starting data: a starter program in lb and three weeks of
 * finished workouts, the last one yesterday so the readiness map and the
 * day-card hints have something to show. Generic, made-up data only.
 *
 * Sessions are built the way the app builds them (`newSession` seeds each
 * one from the ones before it) and ticked in the order the session screen
 * offers sets (`currentSet`), so supersets alternate and ramp sets come first.
 * A seeded PRNG keeps the history the same on every reset; only the dates
 * move with `now`.
 */

const PROGRAM_ID = "upper-lower";

/** Days before `now` each workout happened, oldest first. */
const DAYS_AGO = [20, 18, 16, 15, 13, 11, 8, 6, 4, 1];

const FEELS: SessionFeel[] = ["strong", "strong", "fire", "strong", "spent"];

/** Exercise notes left on the latest workouts, so "Last time" has something to show. */
const NOTES = [
  "felt smooth, try +5 next time",
  "grip gave out before the back did",
  "pause at the bottom helped",
  "left shoulder fine with a narrower grip",
];

/** mulberry32: small, fast and deterministic. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function plus(at: Date, seconds: number): Date {
  return new Date(at.getTime() + seconds * 1000);
}

/** One workout of `day`, lifted and finished starting at `at`. */
function liftedSession(program: Program, dayIndex: number, past: Session[], at: Date, rand: () => number): Session {
  const day = program.days[dayIndex];
  const session = newSession(day, past, program.unit, at);
  let clock = plus(at, 5 * 60 + Math.round(rand() * 120));
  session.warmupDoneAt = clock.toISOString();

  // Some lifts go up a step this time; the next session seeds from it.
  for (const ex of session.exercises) {
    const working = ex.sets.filter((set) => !set.warmup);
    const top = working[0]?.weightLb ?? 0;
    if (top > 0 && !ex.timed && rand() < 0.35) {
      const step = top >= 40 ? 5 : 2.5;
      for (const set of working) set.weightLb += step;
    }
  }

  for (let ref = currentSet(session); ref; ref = currentSet(session)) {
    const ex = session.exercises[ref.e];
    const set = ex.sets[ref.s];
    const isLast = !set.warmup && ex.sets.slice(ref.s + 1).every((s) => s.warmup);
    // Reps sometimes fall one short on the last working set.
    if (isLast && !ex.timed && set.reps > 3 && rand() < 0.3) set.reps -= 1;
    clock = plus(clock, (ex.timed ? set.reps : set.reps * 3) + 15 + Math.round(rand() * 20));
    set.done = true;
    set.doneAt = clock.toISOString();
    const rest = (set.warmup ? set.restSec : ex.restSec) ?? 45;
    clock = plus(clock, rest + Math.round(rand() * 40));
  }

  for (const ex of session.exercises) {
    const pe = day.exercises.find((p) => p.id === ex.exerciseId);
    const target = pe?.targetRPE ?? 8;
    ex.rpe = Math.min(10, Math.max(6, target + Math.round(rand() * 2 - 1)));
  }
  session.finishedAt = plus(clock, 60).toISOString();
  session.sessionFeel = FEELS[Math.floor(rand() * FEELS.length)];
  return session;
}

export function seedDemo(now: Date): { program: Program; sessions: Session[] } {
  const starter = STARTER_PROGRAMS.find((p) => p.id === PROGRAM_ID) ?? STARTER_PROGRAMS[0];
  const program = starter.build("lb");
  const rand = prng(20261010);
  const sessions: Session[] = [];

  DAYS_AGO.forEach((ago, i) => {
    const at = new Date(now);
    at.setDate(at.getDate() - ago);
    at.setHours(17 + Math.floor(rand() * 3), Math.floor(rand() * 60), 0, 0);
    // Rotate through the days so the last cycle ends on yesterday's workout.
    const dayIndex = (i + program.days.length - (DAYS_AGO.length % program.days.length)) % program.days.length;
    sessions.push(liftedSession(program, dayIndex, sessions, at, rand));
  });

  // A note on one lift of each of the latest workouts.
  sessions.slice(-NOTES.length).forEach((session, i) => {
    const ex = session.exercises[Math.floor(rand() * session.exercises.length)];
    ex.note = NOTES[i];
  });

  return { program, sessions };
}
