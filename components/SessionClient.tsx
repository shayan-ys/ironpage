"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { haptic, hapticRef, rpeHaptic } from "@/lib/haptics";
import { VIDEO_BRAVE_KEY } from "@/lib/site";
import { sessionHref } from "@/lib/page-data";
import confetti from "canvas-confetti";
import {
  dropLocal,
  flushDirty,
  hasPending,
  isDirty,
  readLocal,
  syncSession,
  writeLocal,
} from "@/lib/localsync";
import { RpeLegend, rpeStop } from "./RpeSlider";
import type { LoggedSet, ProgramDay, ProgramNoteRow, Session, SessionExercise, SessionFeel, Unit } from "@/lib/types";
import { SetRow } from "./SetRow";
import { ExerciseRpe } from "./ExerciseRpe";
import { FinishSheet } from "./FinishSheet";
import { ConfirmSheet } from "./ConfirmSheet";
import { SheetLayerHost, useShownWhileClosing } from "./Sheet";
import { NotesSheet } from "./NotesSheet";
import type { LastExerciseNote } from "@/lib/notes";
import type { ProgramWeeks } from "@/lib/program-notes";
import { lastWorkAt } from "@/lib/defaults";
import { formatSessionDuration, stripDayEstimate } from "@/lib/duration";
import { shouldOpenExerciseRpe } from "@/lib/session-rpe";
import { MuscleSummary } from "./MuscleSummary";
import { RecoveryLink } from "./RecoveryLink";
import { WarmupCard } from "./WarmupCard";
import { buildRampSet, leadingWarmupCount } from "@/lib/rampsets";
import { currentSet, groupExercises, isSupersetComplete, sameSupersetRun } from "@/lib/supersets";
import { useSupersetScroll } from "./SupersetScroll";
import { CurrentSetPill } from "./CurrentSetPill";
import { findSetRow, focusScrollTop } from "./setFocus";
import { canCompleteSet } from "@/lib/set-order";
import { primeRestAlerts, RestExperience, unlockRestAlerts } from "./RestExperience";
import { HoldTimer, type Hold } from "./HoldTimer";
import { canStartHold } from "@/lib/hold";

export interface ExerciseMeta {
  targetRpe: number;
  /** Program note: the planner's labelled rows for this exercise. */
  notes?: ProgramNoteRow[];
  /** The planner's sentence for progressing once the week steps run out. */
  then?: string;
  /** The program's week steps as of the session start (lib/program-notes.ts). */
  weeks?: ProgramWeeks;
  /** Exercise note from the latest earlier session that included this exercise (lib/notes.ts). */
  lastNote?: LastExerciseNote;
  hint: string;
  guess: boolean;
  lastSets?: { weightLb: number; reps: number }[];
  /**
   * What the same exercise was rated last time. One number, because the rating
   * belongs to the exercise. Reconstructed from the old per-set scores on
   * sessions logged before the move, where it is the hardest set of the lift.
   */
  lastRpe?: number;
}

// A YouTube "proper form" search for the exercise. Parentheticals like
// "(lying/seated)" are dropped so the query stays clean. With the per-device
// Brave flag set, the link is wrapped in Brave's iOS deep-link scheme
// (brave://open-url?url=<encoded https url>).
function formVideoHref(name: string, brave: boolean): string {
  const clean = name.replace(/\s*\([^)]*\)/g, "").trim();
  const yt =
    "https://www.youtube.com/results?search_query=" +
    encodeURIComponent(`${clean} proper form technique`);
  return brave ? `brave://open-url?url=${encodeURIComponent(yt)}` : yt;
}

// Optional coach link from the deployment, with `{sessionId}` filled in.
const COACH_URL = process.env.NEXT_PUBLIC_COACH_URL;

type PendingConfirm = { e: number } | null;
// A weight/reps edit on a non-last set, offering to copy down to later sets.
type Propagate = { e: number; s: number; field: "weight" | "reps"; value: number; count: number } | null;
type SyncState = "saved" | "saving" | "offline";


// Ramp sets are prep, not the workout: they're excluded from both the progress
// counter and the completion test, so an untouched warm-up row can never hold
// the finish sheet hostage and the "x/y sets" figure stays working volume.
function isComplete(sess: Session): boolean {
  let anyDone = false;
  for (const ex of sess.exercises) {
    if (ex.skipped) continue;
    for (const st of ex.sets) {
      if (st.warmup) continue;
      if (st.done) anyDone = true;
      else if (!st.skipped) return false;
    }
  }
  return anyDone;
}

function progress(sess: Session): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const ex of sess.exercises) {
    if (ex.skipped) continue;
    for (const st of ex.sets) {
      if (st.skipped || st.warmup) continue;
      total++;
      if (st.done) done++;
    }
  }
  return { done, total };
}

export function SessionClient({
  initial,
  meta,
  unit,
  warmup,
}: {
  initial: Session;
  meta: Record<string, ExerciseMeta>;
  /** The current program's unit; sessions store none. */
  unit: Unit;
  /** The program day's warm-up, read live; sessions store none. */
  warmup?: ProgramDay["warmup"];
}) {
  const router = useRouter();
  const armSupersetScroll = useSupersetScroll();
  const [session, setSession] = useState<Session>(initial);
  const [confirm, setConfirm] = useState<PendingConfirm>(null);
  const [propagate, setPropagate] = useState<Propagate>(null);
  const [showFinish, setShowFinish] = useState(false);
  const [done, setDone] = useState(!!initial.finishedAt);
  // Finished in this view (body map) vs reopened finished session (chips).
  const [finishedHere, setFinishedHere] = useState(false);
  const [pausing, setPausing] = useState(false);
  // The rest layers move into an open sheet's portal (components/Sheet.tsx).
  const [restHost, setRestHost] = useState<HTMLElement | null>(null);
  const shownPropagate = useShownWhileClosing(propagate);
  const [sync, setSync] = useState<SyncState>("saved");
  const [noteOpen, setNoteOpen] = useState<Record<number, boolean>>({});
  // Exercise index whose notes sheet is open.
  const [notesFor, setNotesFor] = useState<number | null>(null);
  const shownNotesFor = useShownWhileClosing(notesFor);
  // The running hold countdown of a timed exercise (components/HoldTimer.tsx).
  const [hold, setHold] = useState<Hold | null>(null);
  // The countdown or its end alarm owns the screen; a rest ending then is silent.
  const [holdBusy, setHoldBusy] = useState(false);
  // Per-device: read after mount so the server render and hydration agree.
  const [videoBrave, setVideoBrave] = useState(false);
  useEffect(() => {
    setVideoBrave(localStorage.getItem(VIDEO_BRAVE_KEY) === "1");
  }, []);

  const sessionRef = useRef<Session>(initial);
  const saveTimer = useRef<number | undefined>(undefined);
  const autoOpened = useRef(false);
  // Set in the same batch as the local-copy adoption below, so the render it
  // triggers already shows the session the landing scroll measures.
  const [adopted, setAdopted] = useState(false);
  /**
   * The RPE control that is open, by exercise index. Exactly one at a time.
   * There is no clickaway handler by design: the control swaps chip↔slider
   * inside a fixed-height row, so leaving one open costs no layout and blocks
   * nothing — whereas closing on outside pointerdown used to unmount the
   * drawer mid-tap, shifting the page up so the click landed on whatever slid
   * under the finger (typically "skip this exercise").
   */
  const [rpeOpen, setRpeOpen] = useState<number | null>(null);
  /**
   * The exercise whose last tick also completed the session, while its RPE
   * stops wait for a rating. The finish sheet holds until a stop is picked:
   * popping it at once covered the stops that tick had just opened, so the
   * day's final lift could not be rated.
   */
  const [finalRpe, setFinalRpe] = useState<number | null>(null);
  const finalRpeTimer = useRef<number | undefined>(undefined);

  async function persist(next: Session) {
    setSync("saving");
    const ok = await syncSession(next);
    setSync(ok ? "saved" : "offline");
  }

  // Offline-first: local write is synchronous (never lost), server sync is
  // opportunistic and retried on reconnect.
  function mutate(fn: (draft: Session) => void): Session {
    const next = structuredClone(sessionRef.current);
    // Any edit means you are back at it, so the pause is over. Cleared before
    // the callback runs, which is what lets `pause` below set it in a mutation
    // like any other.
    next.pausedAt = null;
    fn(next);
    sessionRef.current = next;
    setSession(next);
    writeLocal(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void persist(next), 600);
    return next;
  }

  const complete = isComplete(session);

  // On mount: adopt any newer local copy (offline reload), drain the outbox,
  // and keep syncing whenever the connection returns.
  useEffect(() => {
    const local = readLocal(initial.id);
    if (initial.finishedAt) {
      // The server has this session closed. A local copy that still looks open
      // is superseded — unless it is still dirty, in which case it holds sets
      // this server copy has never seen and the outbox must deliver them first
      // (the server keeps the closure and takes the sets). Dropping a dirty
      // copy here would silently bin a workout logged in a dead zone.
      if (local && !local.finishedAt && !isDirty(initial.id)) dropLocal(initial.id);
    } else if (local) {
      sessionRef.current = local;
      setSession(local);
      // A finish that never reached the server: show the done screen and let
      // the outbox drain deliver it — never present a closed workout as
      // resumable with "remaining" sets.
      if (local.finishedAt) setDone(true);
    }
    setAdopted(true);
    // Also on return to the foreground: SyncOnLoad drains the outbox then, and
    // this keeps the sync label in step with that drain.
    function refresh() {
      void flushDirty().then(() => setSync(hasPending() ? "offline" : "saved"));
    }
    function onVisible() {
      if (document.visibilityState === "visible") refresh();
    }
    function goOffline() {
      setSync("offline");
    }
    refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", goOffline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", goOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resume lands on the current set, on the focus line, once the adopted copy
  // has rendered: a local copy ahead of the server can have rows the first
  // render did not. A session with nothing logged yet — warm-up unticked, no
  // set ticked or skipped — stays at the top, where the warm-up card is the
  // first thing to do.
  useEffect(() => {
    if (!adopted) return;
    const s = sessionRef.current;
    const started =
      !!s.warmupDoneAt || s.exercises.some((ex) => ex.skipped || ex.sets.some((st) => st.done || st.skipped));
    const current = currentSet(s);
    const row = started && current ? findSetRow(`${current.e}:${current.s}`) : null;
    if (row) window.scrollTo({ top: focusScrollTop(row), behavior: "instant" });
  }, [adopted]);

  // Session-feel sheet pops once, only when everything is done or skipped —
  // after the final lift's rating when its last tick opened the RPE stops.
  useEffect(() => {
    if (complete && !done && finalRpe === null && !autoOpened.current) {
      autoOpened.current = true;
      setShowFinish(true);
    }
    if (!complete) autoOpened.current = false;
  }, [complete, done, finalRpe]);

  /**
   * Default the exercise's rating the moment its last working set is ticked,
   * and clear it again when nothing is ticked. A finished lift is therefore
   * never unrated, and an exercise you un-ticked back to empty does not keep a
   * score for work that is no longer logged. In between, an explicit rating is
   * left alone — that is the number the lifter chose.
   */
  function settleExerciseRpe(ex: SessionExercise, targetRpe: number) {
    const working = ex.sets.filter((st) => !st.warmup);
    const anyDone = working.some((st) => st.done);
    if (!anyDone) {
      ex.rpe = null;
      return;
    }
    const allSettled = working.every((st) => st.done || st.skipped);
    if (allSettled && (ex.rpe === null || ex.rpe === undefined)) ex.rpe = targetRpe;
  }

  /** `doneAt` dates a tick the hold timer makes at the hold's end time. */
  function toggleDone(e: number, s: number, doneAt?: string) {
    const before = sessionRef.current;
    // Working sets complete in order; ignore a tick that skips ahead.
    if (!canCompleteSet(before, e, s)) return;
    const wasDone = before.exercises[e].sets[s].done;
    const previousCurrent = currentSet(before);
    let openRpe = false;
    const next = mutate((n) => {
      const ex = n.exercises[e];
      const set = ex.sets[s];
      if (set.done) {
        set.done = false;
      } else {
        set.done = true;
        set.doneAt = doneAt ?? new Date().toISOString();
      }
      settleExerciseRpe(ex, meta[ex.exerciseId]?.targetRpe ?? 8);
      openRpe = !wasDone && shouldOpenExerciseRpe(ex.sets, s);
    });
    if (!wasDone) {
      primeRestAlerts(next);
      const nextCurrent = currentSet(next);
      if (
        previousCurrent?.e === e &&
        previousCurrent.s === s &&
        nextCurrent &&
        nextCurrent.e !== e &&
        sameSupersetRun(next, e, nextCurrent.e)
      ) {
        armSupersetScroll(`${nextCurrent.e}:${nextCurrent.s}`);
      }
    }
    if (openRpe) setRpeOpen(e);
    clearTimeout(finalRpeTimer.current);
    setFinalRpe(openRpe && isComplete(next) ? e : null);
    haptic("light");
  }

  /**
   * Start a timed row's hold: its `reps` are the seconds. Runs in the tap, the
   * gesture iOS needs to unlock the chime the end alarm plays.
   */
  function startHold(e: number, s: number, label: string) {
    const current = sessionRef.current;
    if (!canStartHold(current, e, s)) return;
    unlockRestAlerts();
    const ex = current.exercises[e];
    const seconds = ex.sets[s].reps;
    setHold({ e, s, endsAt: Date.now() + seconds * 1000, seconds, name: ex.name, label });
  }

  /** The hold reached zero: tick its set through the normal path, dated at the end. */
  function endHold(ended: Hold) {
    setHold(null);
    if (sessionRef.current.exercises[ended.e]?.sets[ended.s]?.done === false) {
      toggleDone(ended.e, ended.s, new Date(ended.endsAt).toISOString());
    }
  }

  // Offer to copy a weight/reps change down to the later sets of this exercise.
  // Ramp and working sets never bleed into each other: a 50% warm-up must not
  // overwrite the working sets below it, and vice versa.
  function maybePropagate(e: number, s: number, field: "weight" | "reps", value: number) {
    const ex = sessionRef.current.exercises[e];
    if (s >= ex.sets.length - 1) return;
    const kind = !!ex.sets[s].warmup;
    const count = ex.sets
      .slice(s + 1)
      .filter((st) => !!st.warmup === kind && (field === "weight" ? st.weightLb : st.reps) !== value).length;
    if (count === 0) return;
    setPropagate({ e, s, field, value, count });
  }

  function applyPropagate() {
    const p = propagate;
    if (!p) return;
    mutate((n) => {
      const sets = n.exercises[p.e].sets;
      const kind = !!sets[p.s].warmup;
      for (let i = p.s + 1; i < sets.length; i++) {
        const st = sets[i];
        if (!!st.warmup !== kind) continue;
        if (p.field === "weight") st.weightLb = p.value;
        else st.reps = p.value;
      }
    });
    setPropagate(null);
  }

  function addSet(e: number) {
    mutate((n) => {
      const sets = n.exercises[e].sets;
      // Clone the last *working* set: on an exercise that's all ramp so far,
      // copying the trailing row would seed the working set at warm-up load.
      const last = [...sets].reverse().find((st) => !st.warmup);
      const fresh: LoggedSet = {
        weightLb: last?.weightLb ?? 0,
        reps: last?.reps ?? 8,
        rpe: null,
        done: false,
        skipped: false,
      };
      sets.push(fresh);
    });
  }

  /**
   * Append a ramp set to this exercise's leading warm-up run, with load and
   * reps proposed from the first working set. Inserting (rather than pushing)
   * keeps ramps ahead of working sets, which is both the order you lift in and
   * what lets every other rule here treat them as a prefix.
   */
  function addWarmupSet(e: number) {
    mutate((n) => {
      const sets = n.exercises[e].sets;
      const at = leadingWarmupCount(sets);
      const working = sets.find((st) => !st.warmup);
      sets.splice(at, 0, buildRampSet(working?.weightLb ?? 0, working?.reps ?? 8, at, unit));
    });
  }

  /** Drop a ramp set. Working sets have no delete path — only ramps do. */
  function removeSet(e: number, s: number) {
    mutate((n) => {
      n.exercises[e].sets.splice(s, 1);
    });
  }

  /**
   * One tick for the whole general warm-up. The timestamp is the point of it:
   * it dates the prep/work boundary, so the gap to the first set's `doneAt`
   * says how long that opening lift really took.
   */
  function toggleWarmup() {
    mutate((n) => {
      n.warmupDoneAt = n.warmupDoneAt ? null : new Date().toISOString();
    });
    haptic("light");
  }

  function editNote(e: number, text: string) {
    mutate((n) => {
      n.exercises[e].note = text;
    });
  }

  function doSkipExercise(e: number) {
    mutate((n) => {
      n.exercises[e].skipped = true;
    });
    if (rpeOpen === e) setRpeOpen(null);
  }

  function runConfirm() {
    if (!confirm) return;
    doSkipExercise(confirm.e);
    setConfirm(null);
  }

  /**
   * Close the session out. Covers both endings the record cannot tell apart
   * afterwards: everything ticked ("Finish workout"), or you are done for the
   * day with sets left ("End workout"). Either way `finishedAt` is now, which is
   * right — you are here. Confetti only when something was actually lifted;
   * celebrating a session you closed with nothing logged is noise.
   *
   * Optimistic: the celebration lands immediately, but the server write is
   * awaited before the router cache is invalidated. Refreshing while the PATCH
   * is still in flight would let the overview re-read this session as active —
   * which is why a finished workout kept coming back as "Resume".
   */
  async function finish(feel: SessionFeel | null) {
    const next = mutate((n) => {
      n.finishedAt = new Date().toISOString();
      n.sessionFeel = feel;
    });
    clearTimeout(saveTimer.current);
    setShowFinish(false);
    setDone(true);
    setFinishedHere(true);
    if (lastWorkAt(next) !== null) void confetti({ particleCount: 140, spread: 78, origin: { y: 0.6 } });
    await persist(next);
    router.refresh();
  }

  /**
   * Pause: leave the session open and walk away, with the intent recorded. This
   * is the exit that is *not* finishing — sets, weights and place are kept, the
   * overview offers it back as "Resume", and picking it up tomorrow continues
   * the same record. A pause you never return to closes itself after
   * `ABANDON_AFTER_MS` (lib/defaults.ts) instead of haunting the overview.
   *
   * The local write inside `mutate` is synchronous, so this works with no
   * signal. The PATCH is still awaited before navigating, so the overview's
   * server render cannot be re-read from before the pause landed.
   */
  async function pause() {
    if (pausing) return;
    setPausing(true);
    const next = mutate((n) => {
      n.pausedAt = new Date().toISOString();
    });
    clearTimeout(saveTimer.current);
    await persist(next);
    router.push("/");
    router.refresh();
  }

  if (done) {
    const worked = lastWorkAt(session) !== null;
    const duration = worked ? formatSessionDuration(session.startedAt, session.finishedAt) : null;
    return (
      <main className="centered">
        <div style={{ fontSize: 54 }}>{worked ? "🎉" : "📕"}</div>
        <h1 className="title" style={{ margin: 0 }}>
          {stripDayEstimate(session.dayName)} {worked ? "logged" : "closed"}
        </h1>
        <p className="subtle">
          {duration ? `${duration} · ` : ""}
          {sync === "offline"
            ? "Saved on this phone. It syncs itself the moment you have signal — you can close the app."
            : worked
              ? "Saved."
              : "Saved as an empty session, so it will not count as having trained this day."}
        </p>
        <MuscleSummary session={session} mode={finishedHere ? "map" : "chips"} />
        <button
          className="save"
          style={{ maxWidth: 260 }}
          ref={hapticRef}
          data-haptic="medium"
          onClick={() => {
            router.push("/");
            router.refresh();
          }}
        >
          Back to overview
        </button>
      </main>
    );
  }

  const { done: pDone, total: pTotal } = progress(session);
  const pct = pTotal > 0 ? Math.round((pDone / pTotal) * 100) : 0;
  const syncLabel = sync === "saved" ? "✓ saved" : sync === "saving" ? "saving…" : "offline · will sync";

  // The set you are working: the first one still pending. It is highlighted,
  // the resume landing and the jump pill aim at it. Nothing selects a row by
  // hand any more — with the rating moved up to the exercise, there is nothing
  // to open on a set.
  const firstPending = currentSet(session);

  return (
    <SheetLayerHost.Provider value={setRestHost}>
      <header className="shead">
        <Link className="back" href="/" ref={hapticRef} data-haptic="medium">
          ← overview
        </Link>
        <div className="headactions">
          {!session.finishedAt && COACH_URL && (
            <a
              className="coachpill"
              href={COACH_URL.replaceAll("{sessionId}", encodeURIComponent(session.id))}
              aria-label="Open the coach"
              ref={hapticRef}
              data-haptic="medium"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12Z" />
              </svg>
              <b>Coach</b>
            </a>
          )}
          <RecoveryLink from={sessionHref(session.id)} />
        </div>
        <div className="kicker">{new Date(session.startedAt).toLocaleDateString(undefined, { weekday: "long" })}</div>
        <div className="title-row">
          <h1>{session.dayName}</h1>
        </div>
      </header>
      {/* Sticky session progress. Sits below the header in the DOM, so the day
          title scrolls away normally and this pins once it reaches the top —
          the one number worth keeping on screen for a whole session. */}
      <div className="progresswrap">
        <div className="progress">
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="progresstxt">
          <span>
            {pDone}/{pTotal} sets · {pct}%
          </span>
          <span className={`syncst ${sync}`}>{syncLabel}</span>
        </div>
      </div>

      <WarmupCard
        warmup={warmup}
        doneAt={session.warmupDoneAt ?? null}
        onToggle={toggleWarmup}
      />

      <div className="exwrap">
        {groupExercises(session.exercises).map((run) => {
          const sections: ReactNode[] = [];
          for (let e = run.start; e <= run.end; e++) {
            const ex = session.exercises[e];
            const m = meta[ex.exerciseId];
            // The pill shows only when the notes sheet would have something in it.
            const hasNotes =
              !!m?.lastNote || !!m?.notes?.length || !!m?.weeks || !!m?.then ||
              Object.values(ex.muscles ?? {}).some((s) => (s ?? 0) > 0);
            const target = m?.targetRpe ?? 8;
            // Ramp sets don't gate the exercise's ✓ either — a lift is finished
            // when its working sets are.
            const working = ex.sets.filter((st) => !st.warmup);
            const exComplete =
              !ex.skipped && working.length > 0 && working.every((st) => st.done || st.skipped) && working.some((st) => st.done);
            sections.push(
              <section
                key={ex.exerciseId}
                className={`ex${e === 0 ? " first" : ""}${ex.skipped ? " exskip" : ""}${exComplete ? " done" : ""}`}
              >
                <div className="exhead">
                  <h2 className="exname">{ex.name}</h2>
                  <div className="extools">
                    <a
                      className="extool formvid"
                      href={formVideoHref(ex.name, videoBrave)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Watch proper form for ${ex.name} on YouTube`}
                      ref={hapticRef}
                      data-haptic="medium"
                    >
                      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                        <rect x="2" y="4" width="20" height="14" rx="2" />
                        <path d="M10 8.5v5l4.5-2.5Z" />
                        <path d="M8 21h8" />
                      </svg>
                      <b>form</b>
                    </a>
                    {/* Opens the notes sheet: Last time · Plan · How to. */}
                    {hasNotes && (
                      <button
                        type="button"
                        className={`extool notespill${m?.lastNote ? " has-last" : ""}`}
                        aria-label={`Notes for ${ex.name}`}
                        ref={hapticRef}
                        data-haptic="selection"
                        onClick={() => setNotesFor(e)}
                      >
                        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                          <path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                {m?.guess && <div className="hint guess">{m.hint}</div>}
                {ex.skipped ? (
                  <div className="exmeta">exercise skipped</div>
                ) : (
                  <>
                    {m?.lastSets && (
                      <div className="lastrow">
                        <span className="k">last</span>
                        {m.lastSets.map((x, i) => (
                          <span key={i} className="cell">
                            {x.weightLb}×{x.reps}
                          </span>
                        ))}
                        {m.lastRpe ? <span className="cell atrpe" data-rpe={rpeStop(m.lastRpe)}>@{m.lastRpe}</span> : null}
                      </div>
                    )}
                    <div className="sets">
                      {ex.sets.map((set, s) => {
                        // Ramp and working sets are numbered in separate runs, so
                        // adding a warm-up never renumbers the working sets you
                        // and the programme both think of as "set 1, 2, 3".
                        const warm = !!set.warmup;
                        const label = warm
                          ? `W${ex.sets.slice(0, s + 1).filter((x) => x.warmup).length}`
                          : String(ex.sets.slice(0, s + 1).filter((x) => !x.warmup).length);
                        return (
                          <div key={s} data-setref={`${e}:${s}`}>
                            <SetRow
                              label={label}
                              warm={warm}
                              set={set}
                              unit={unit}
                              active={firstPending?.e === e && firstPending?.s === s}
                              blocked={!canCompleteSet(session, e, s)}
                              hold={
                                ex.timed
                                  ? { disabled: !canStartHold(session, e, s), onStart: () => startHold(e, s, label) }
                                  : undefined
                              }
                              onToggleDone={() => toggleDone(e, s)}
                              onWeight={(v) => mutate((n) => void (n.exercises[e].sets[s].weightLb = v))}
                              onWeightDone={(v) => maybePropagate(e, s, "weight", v)}
                              onReps={(v) => {
                                mutate((n) => void (n.exercises[e].sets[s].reps = v));
                                maybePropagate(e, s, "reps", v);
                              }}
                              onUnskip={() => mutate((n) => void (n.exercises[e].sets[s].skipped = false))}
                              onRemove={warm ? () => removeSet(e, s) : undefined}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <ExerciseRpe
                      value={ex.rpe ?? null}
                      target={target}
                      open={rpeOpen === e}
                      onOpen={() => setRpeOpen(e)}
                      onChange={(v) => {
                        mutate((n) => {
                          n.exercises[e].rpe = v;
                        });
                        haptic(rpeHaptic(v));
                        if (finalRpe === e) {
                          // Let the pick show, then fold the stops; the finish sheet follows.
                          clearTimeout(finalRpeTimer.current);
                          finalRpeTimer.current = window.setTimeout(() => {
                            setRpeOpen((open) => (open === e ? null : open));
                            setFinalRpe(null);
                          }, 600);
                        }
                      }}
                    />
                    {ex.note || noteOpen[e] ? (
                      <textarea
                        className="usernote"
                        rows={2}
                        autoFocus={!ex.note}
                        placeholder="note — e.g. weight is per hand, tweaked setup…"
                        value={ex.note ?? ""}
                        onChange={(ev) => editNote(e, ev.target.value)}
                        onBlur={() => setNoteOpen((o) => ({ ...o, [e]: false }))}
                      />
                    ) : (
                      <button
                        className="addnote"
                        ref={hapticRef}
                        data-haptic="light"
                        onClick={() => setNoteOpen((o) => ({ ...o, [e]: true }))}
                      >
                        ＋ note
                      </button>
                    )}
                    <div className="addrow">
                      <button className="addset warm" ref={hapticRef} data-haptic="light" onClick={() => addWarmupSet(e)}>
                        + warm-up set
                      </button>
                      <button className="addset" ref={hapticRef} data-haptic="light" onClick={() => addSet(e)}>
                        + set
                      </button>
                    </div>
                    <button className="skipex" ref={hapticRef} data-haptic="medium" onClick={() => setConfirm({ e })}>
                      skip this exercise
                    </button>
                  </>
                )}
              </section>,
            );
          }
          if (run.supersetId === null || run.start === run.end) return sections;
          const lit = firstPending !== null && firstPending.e >= run.start && firstPending.e <= run.end;
          const state = lit ? "lit" : isSupersetComplete(session, run.start) ? "done" : "idle";
          return (
            <div key={`superset-${run.start}`} className={`superset-frame superset-frame--${state}`}>
              {sections}
              <span className="superset-link" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </span>
            </div>
          );
        })}
      </div>

      <RpeLegend />

      {/* Two ways out, and they mean different things. Pause keeps the session
          open for tomorrow; End closes the record with whatever is ticked.
          Neither needs a connection: both write locally first. */}
      <div className="finishbar">
        <button className="pausebtn" ref={hapticRef} data-haptic="medium" onClick={pause} disabled={pausing}>
          {pausing ? "Pausing…" : "Pause"}
        </button>
        <button className="endbtn" ref={hapticRef} data-haptic="medium" onClick={() => setShowFinish(true)}>
          {complete ? "Finish workout" : "End workout"}
        </button>
      </div>

      <CurrentSetPill targetKey={firstPending ? `${firstPending.e}:${firstPending.s}` : null} />

      <RestExperience session={session} host={restHost} holdRunning={holdBusy} />
      <HoldTimer
        hold={hold}
        host={restHost}
        onEnd={endHold}
        onCancel={() => setHold(null)}
        onBusyChange={setHoldBusy}
      />

      <FinishSheet
        open={showFinish}
        remaining={pTotal - pDone}
        onFinish={finish}
        onPause={pause}
        onClose={() => setShowFinish(false)}
      />

      <ConfirmSheet
        open={!!confirm}
        title="Skip this exercise?"
        body="Every remaining set here gets skipped."
        confirmLabel="Skip exercise"
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
      />

      {shownPropagate && (
        <ConfirmSheet
          open={!!propagate}
          title={`Apply to the ${shownPropagate.count} set${shownPropagate.count > 1 ? "s" : ""} below?`}
          body={
            shownPropagate.field === "weight"
              ? `Set the remaining sets to ${shownPropagate.value} ${unit} too. Last session's numbers stay in the "last" row.`
              : `Set the remaining sets to ${shownPropagate.value} reps too.`
          }
          confirmLabel="Apply to rest"
          cancelLabel="Just this set"
          tone="accent"
          onConfirm={applyPropagate}
          onClose={() => setPropagate(null)}
        />
      )}

      {shownNotesFor !== null && (
        <NotesSheet
          open={notesFor !== null}
          name={session.exercises[shownNotesFor].name}
          muscles={session.exercises[shownNotesFor].muscles}
          unit={unit}
          lastNote={meta[session.exercises[shownNotesFor].exerciseId]?.lastNote}
          notes={meta[session.exercises[shownNotesFor].exerciseId]?.notes}
          weeks={meta[session.exercises[shownNotesFor].exerciseId]?.weeks}
          then={meta[session.exercises[shownNotesFor].exerciseId]?.then}
          onClose={() => setNotesFor(null)}
        />
      )}
    </SheetLayerHost.Provider>
  );
}
