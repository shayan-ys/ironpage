"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProgramDay, Session } from "@/lib/types";
import { dayReadinessHint, type ReadinessDose } from "@/lib/muscles";
import { isAbandoned, isStale, lastActivityAt } from "@/lib/defaults";
import { locallyFinished, readLocal, syncSession } from "@/lib/localsync";
import { hapticRef } from "@/lib/haptics";
import { sessionHref } from "@/lib/page-data";
import { groupExercises } from "@/lib/supersets";
import { useUpdateHold } from "@/components/UpdateCheck";
import { useReadiness } from "@/components/useReadiness";
import { Sheet } from "@/components/Sheet";

/**
 * Whole calendar days between the local date of `iso` and today's local date.
 * Calendar-based (not elapsed 24h chunks), so a session finished yesterday 6pm
 * reads "yesterday" this morning, not "today".
 */
function calendarDaysAgo(iso: string): number {
  const then = new Date(iso);
  const now = new Date();
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((midnight(now) - midnight(then)) / 86_400_000);
}

/** Human "when last done" line for the card footer. */
function lastLabel(iso: string | null): string {
  if (!iso) return "Not done yet";
  const d = calendarDaysAgo(iso);
  if (d <= 0) return "Last done today";
  if (d === 1) return "Last done yesterday";
  return `Last done ${d} days ago`;
}

/** Trained within the last 2 calendar days (today or yesterday). */
function recentlyDone(iso: string | null): boolean {
  return iso !== null && calendarDaysAgo(iso) < 2;
}

export function DayCard({
  day,
  lastPerformed,
  active,
  doses,
}: {
  day: ProgramDay;
  lastPerformed: string | null;
  active: Session | null;
  doses: ReadinessDose[];
}) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [prompt, setPrompt] = useState(false);
  // An app-update reload must not drop a start in flight (the server may have
  // created the session before the navigation) or the confirmation sheet.
  useUpdateHold(starting || prompt);
  // Day math depends on the device's local date; compute only after mount so
  // the server (UTC) render matches hydration, then fills in correctly.
  const [mounted, setMounted] = useState(false);
  /**
   * The open session this card should act on — the server's `active`, filtered
   * by two things only the device knows, hence post-mount:
   *
   * - it was finished here and the write has not landed yet (or the whole page
   *   came from the service worker cache), so it is not open at all;
   * - it is idle past `ABANDON_AFTER_MS`, so it is already dead. The server
   *   reaps those on read, and this is the client-side backstop for a cached
   *   render — a workout you paused two weeks ago must never offer "Resume".
   */
  const [open, setOpen] = useState<Session | null>(null);
  useEffect(() => {
    setMounted(true);
    setOpen(active && !locallyFinished(active.id) && !isAbandoned(active) ? active : null);
  }, [active]);
  const recent = mounted && recentlyDone(lastPerformed);
  const footer = mounted ? lastLabel(lastPerformed) : "";
  const readyHint = dayReadinessHint(day, useReadiness(doses) ?? null);
  // "Resume" only when tapping really resumes. A stale same-day session is
  // closed and replaced instead (see `start`), so promising "Resume" there
  // would mislabel the button.
  const resumable = !!open && open.dayId === day.id && !isStale(open);

  async function create() {
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dayId: day.id }),
      });
      if (!res.ok) throw new Error(`POST /api/session ${res.status}`);
      const session = (await res.json()) as Session;
      router.push(sessionHref(session.id));
    } catch {
      // Starting is the one thing that needs the server: the id and the seeded
      // weights are minted there from every past session. Say so instead of
      // sitting on "Starting…" forever, which is what a bare throw used to do.
      setStarting(false);
      setFailed(true);
    }
  }

  async function start() {
    if (starting) return;
    setFailed(false);
    if (open) {
      // Same day and recently active → closed the app mid-workout or paused it,
      // so resume. Same day but stale → an artifact of a lost finish; silently
      // resuming it is how two workouts once merged into one record, so prompt.
      if (open.dayId === day.id && !isStale(open)) {
        router.push(sessionHref(open.id));
        return;
      }
      setPrompt(true);
      return;
    }
    setStarting(true);
    await create();
  }

  async function closeAndStart() {
    setPrompt(false);
    setStarting(true);
    if (open) {
      // Close *this device's* copy when it has one. The server render can
      // predate sets logged in a dead zone, and writing the server copy back
      // would erase them — the outbox holds the richer version.
      //
      // Dated by its last activity, not now: that session was abandoned some
      // time ago and "now" would misdate it to today. syncSession gives the
      // write keepalive + retry, same as every other session mutation.
      const base = readLocal(open.id) ?? open;
      await syncSession({ ...base, finishedAt: lastActivityAt(base), pausedAt: null });
    }
    await create();
  }

  return (
    <>
      <button
        className={`daycard${recent ? " recent" : ""}`}
        ref={hapticRef}
        data-haptic="medium"
        onClick={start}
        disabled={starting}
      >
        <div className="top">
          <h2>{day.name}</h2>
          <span className="count">{day.exercises.length} lifts</span>
        </div>
        <div className="exlist">
          {groupExercises(day.exercises).map((run) => {
            const names = day.exercises.slice(run.start, run.end + 1).map((exercise) => exercise.name);
            return (
              <span key={run.start} className="ex">
                {names.join(" + ")}
              </span>
            );
          })}
        </div>
        <div className="start">
          {starting ? "Starting…" : resumable ? "Resume →" : "Start →"}
        </div>
        <div className="lastdone">{footer}</div>
        {readyHint && <div className="readyhint">{readyHint}</div>}
      </button>
      {failed && (
        <p className="cardwarn">
          No signal — starting a new workout needs a connection. A session already in
          progress keeps logging offline.
        </p>
      )}

      {open && (
        // `prompt` also holds app-update reloads (useUpdateHold above), so
        // every way of closing this sheet must clear it.
        <Sheet
          open={prompt}
          onClose={() => setPrompt(false)}
          className="confirm"
          title={open.dayId === day.id ? `Start a fresh ${day.name}?` : `Finish ${open.dayName} first?`}
        >
          {open.dayId === day.id ? (
            <p>
              There’s an old unfinished {open.dayName} session still open. Starting fresh
              closes it as its own workout, dated by its last logged set — nothing is lost.
            </p>
          ) : (
            <p>You’ve got an unfinished {open.dayName} session. Starting {day.name} will close it out.</p>
          )}
          <div className="confirmcol">
            <button
              className="save"
              ref={hapticRef}
              data-haptic="medium"
              onClick={() => router.push(sessionHref(open.id))}
            >
              Resume {open.dayName}
            </button>
            <button className="dangerbtn" ref={hapticRef} data-haptic="heavy" onClick={closeAndStart}>
              {open.dayId === day.id ? "Close it & start fresh" : `Close it & start ${day.name}`}
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}
