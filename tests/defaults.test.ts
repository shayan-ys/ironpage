import { describe, expect, it } from "vitest";
import {
  ABANDON_AFTER_MS,
  buildSessionExercises,
  lastWorkAt,
  isAbandoned,
  isStale,
  lastActivityAt,
  msUntilAbandon,
  newSession,
  reapAbandoned,
  resolveIncoming,
  STALE_AFTER_MS,
} from "../lib/defaults";
import type { ProgramDay, Session, SessionExercise } from "../lib/types";

function sessionWith(startedAt: string, doneAt?: string): Session {
  return {
    id: "s1",
    dayId: "day-c",
    dayName: "Day C",
    startedAt,
    finishedAt: null,
    sessionFeel: null,
    exercises: [
      {
        exerciseId: "bench",
        name: "Bench",
        skipped: false,
        sets: [{ weightLb: 100, reps: 8, rpe: 8, done: !!doneAt, skipped: false, doneAt }],
      },
    ],
  };
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
describe("buildSessionExercises", () => {
  const day: ProgramDay = {
    id: "day-a",
    name: "Day A",
    exercises: [
      {
        id: "lift",
        name: "Lift",
        targetSets: 2,
        targetReps: 8,
        targetRPE: 8,
        seedWeight: 20,
        seedIsGuess: true,
      },
    ],
  };
  const pastSession = (sets: Session["exercises"][number]["sets"]): Session => ({
    id: "history",
    dayId: day.id,
    dayName: day.name,
    startedAt: hoursAgo(2),
    finishedAt: null,
    sessionFeel: null,
    exercises: [{ exerciseId: "lift", name: "Lift", skipped: false, sets }],
  });
  const doneSet = (weightLb: number, options: { done?: boolean; warmup?: boolean } = {}) => ({
    weightLb,
    reps: 8,
    rpe: null,
    done: options.done ?? true,
    skipped: false,
    ...(options.warmup ? { warmup: true } : {}),
  });

  const ladder: ProgramDay = {
    ...day,
    exercises: [
      {
        ...day.exercises[0],
        targets: [
          { from: "2026-09-29T00:00:00-04:00", weightLb: 50 },
          { from: "2026-10-06T00:00:00-04:00", weightLb: 70, reps: 12 },
        ],
      },
    ],
  };
  const weights = (exercises: SessionExercise[]) => exercises[0].sets.map((set) => set.weightLb);

  it("snapshots a timed exercise's flag and omits it otherwise", () => {
    const timedDay: ProgramDay = {
      ...day,
      exercises: [
        { ...day.exercises[0], timed: true },
        { ...day.exercises[0], id: "plain", timed: false },
        { ...day.exercises[0], id: "unset" },
      ],
    };
    const [timed, plain, unset] = buildSessionExercises(timedDay, []);
    expect(timed.timed).toBe(true);
    expect("timed" in plain).toBe(false);
    expect("timed" in unset).toBe(false);
  });

  it("uses the active target when history is below it", () => {
    const exercises = buildSessionExercises(ladder, [pastSession([doneSet(35), doneSet(45)])], new Date("2026-09-30T22:00:00Z"));
    expect(weights(exercises)).toEqual([50, 50]);
  });

  it("keeps per-set history above the active target", () => {
    const exercises = buildSessionExercises(ladder, [pastSession([doneSet(55), doneSet(60)])], new Date("2026-09-30T22:00:00Z"));
    expect(weights(exercises)).toEqual([55, 60]);
  });

  it("steps up at the next step's start, in the step's own timezone, with its reps", () => {
    // 23:30 at UTC-4 on Oct 5 is already Oct 6 in UTC; the week has not turned yet.
    const before = buildSessionExercises(ladder, [], new Date("2026-10-06T03:30:00Z"));
    expect(weights(before)).toEqual([50, 50]);
    expect(before[0].sets[0].reps).toBe(8);
    const after = buildSessionExercises(ladder, [], new Date("2026-10-06T04:00:00Z"));
    expect(weights(after)).toEqual([70, 70]);
    expect(after[0].sets[0].reps).toBe(12);
  });
  it("overrides the set count for W1 and reverts to targetSets at W2", () => {
    const dayWithSetLadder: ProgramDay = {
      ...day,
      exercises: [
        {
          ...day.exercises[0],
          targetSets: 3,
          targets: [
            { from: "2026-09-29T00:00:00-04:00", sets: 2 },
            { from: "2026-10-06T00:00:00-04:00" },
          ],
        },
      ],
    };

    expect(buildSessionExercises(dayWithSetLadder, [], new Date("2026-09-30T12:00:00-04:00"))[0].sets).toHaveLength(2);
    expect(buildSessionExercises(dayWithSetLadder, [], new Date("2026-10-06T12:00:00-04:00"))[0].sets).toHaveLength(3);
  });

  it("leaves history and seed pre-fills unchanged for a weightless step", () => {
    const weightlessLadder: ProgramDay = {
      ...day,
      exercises: [
        {
          ...day.exercises[0],
          targets: [{ from: "2026-09-29T00:00:00-04:00", sets: 2 }],
        },
      ],
    };

    expect(weights(buildSessionExercises(weightlessLadder, [pastSession([doneSet(35), doneSet(45)])], new Date("2026-09-30T12:00:00-04:00")))).toEqual([35, 45]);
    expect(weights(buildSessionExercises(weightlessLadder, [], new Date("2026-09-30T12:00:00-04:00")))).toEqual([20, 20]);
  });

  it("skips steps with invalid set counts", () => {
    for (const sets of [0, 2.5]) {
      const invalidLaterStep: ProgramDay = {
        ...day,
        exercises: [
          {
            ...day.exercises[0],
            targetSets: 3,
            targets: [
              { from: "2026-09-29T00:00:00-04:00", sets: 2 },
              { from: "2026-10-06T00:00:00-04:00", sets },
            ],
          },
        ],
      };

      expect(buildSessionExercises(invalidLaterStep, [], new Date("2026-10-07T12:00:00-04:00"))[0].sets).toHaveLength(2);
    }
  });


  it("falls back to history, then the seed, before the first step starts", () => {
    const at = new Date("2026-09-28T12:00:00Z");
    expect(weights(buildSessionExercises(ladder, [pastSession([doneSet(35), doneSet(45)])], at))).toEqual([35, 45]);
    expect(weights(buildSessionExercises(ladder, [], at))).toEqual([20, 20]);
  });

  it("keeps history unchanged when there is no target", () => {
    const exercises = buildSessionExercises(day, [pastSession([doneSet(35), doneSet(45)])]);
    expect(exercises[0].sets.map((set) => set.weightLb)).toEqual([35, 45]);
  });

  it("ignores warm-up and not-done history sets, including pre-filled sets", () => {
    const firstPrefill = buildSessionExercises(day, []);
    const history = pastSession([
      doneSet(70, { warmup: true }),
      doneSet(firstPrefill[0].sets[0].weightLb, { done: false }),
      doneSet(40),
    ]);
    const exercises = buildSessionExercises(day, [history]);
    expect(exercises[0].sets.map((set) => set.weightLb)).toEqual([40, 40]);
  });

  it("leads with the active step's planned ramp sets, else the exercise's own", () => {
    const ramped: ProgramDay = {
      ...day,
      exercises: [
        {
          ...day.exercises[0],
          rampSets: [{ weightLb: 10, reps: 8 }],
          targets: [
            { from: "2026-09-29T00:00:00-04:00", weightLb: 50, rampSets: [{ weightLb: 25, reps: 6 }, { weightLb: 40, reps: 3 }] },
            { from: "2026-10-06T00:00:00-04:00", weightLb: 70 },
          ],
        },
      ],
    };
    const [week1, week2] = ["2026-10-02T16:00:00Z", "2026-10-07T16:00:00Z"].map((at) =>
      buildSessionExercises(ramped, [], new Date(at))[0].sets.map((s) => [s.weightLb, s.reps, !!s.warmup, s.done]),
    );
    expect(week1).toEqual([
      [25, 6, true, false],
      [40, 3, true, false],
      [50, 8, false, false],
      [50, 8, false, false],
    ]);
    expect(week2).toEqual([
      [10, 8, true, false],
      [70, 8, false, false],
      [70, 8, false, false],
    ]);
  });
});

describe("isStale", () => {
  it("a session active two hours ago is not stale (resume it)", () => {
    expect(isStale(sessionWith(hoursAgo(3), hoursAgo(2)))).toBe(false);
  });

  it("a session inactive for 10 days is stale (never silently resume)", () => {
    expect(isStale(sessionWith(hoursAgo(240), hoursAgo(239)))).toBe(true);
  });

  it("measures from the last logged set, not the start time", () => {
    // Started 30h ago but a set was ticked 1h ago → still live.
    expect(isStale(sessionWith(hoursAgo(30), hoursAgo(1)))).toBe(false);
  });

  it("falls back to startedAt when nothing was ever ticked", () => {
    expect(isStale(sessionWith(hoursAgo(30)))).toBe(true);
    expect(isStale(sessionWith(hoursAgo(1)))).toBe(false);
  });

  it("threshold is 24 hours", () => {
    expect(STALE_AFTER_MS).toBe(24 * 60 * 60 * 1000);
    // lastActivityAt falls back to startedAt when no set was ever ticked.
    const s = sessionWith(hoursAgo(1));
    expect(lastActivityAt(s)).toBe(s.startedAt);
  });
});

describe("lastActivityAt", () => {
  it("counts an explicit pause as activity", () => {
    // Nothing ticked, but you were provably at the gym an hour ago: that is
    // when the workout stopped, and what a later close-out must be dated by.
    const s = { ...sessionWith(hoursAgo(30)), pausedAt: hoursAgo(1) };
    expect(lastActivityAt(s)).toBe(s.pausedAt);
    expect(isStale(s)).toBe(false);
  });

  it("counts the general warm-up tick as activity", () => {
    const s = { ...sessionWith(hoursAgo(30)), warmupDoneAt: hoursAgo(2) };
    expect(lastActivityAt(s)).toBe(s.warmupDoneAt);
  });

  it("takes the latest of set, warm-up and pause", () => {
    const s = {
      ...sessionWith(hoursAgo(9), hoursAgo(4)),
      warmupDoneAt: hoursAgo(8),
      pausedAt: hoursAgo(2),
    };
    expect(lastActivityAt(s)).toBe(s.pausedAt);
  });
});

describe("isAbandoned", () => {
  it("is three days, not one: a session paused yesterday is still yours", () => {
    expect(ABANDON_AFTER_MS).toBe(3 * STALE_AFTER_MS);
    const paused = { ...sessionWith(hoursAgo(40)), pausedAt: hoursAgo(26) };
    // Past the resume-silently threshold, but nowhere near timed out.
    expect(isStale(paused)).toBe(true);
    expect(isAbandoned(paused)).toBe(false);
  });

  it("times out a pause nobody came back to", () => {
    expect(isAbandoned({ ...sessionWith(hoursAgo(100)), pausedAt: hoursAgo(80) })).toBe(true);
  });

  it("counts down in whole days and never goes negative", () => {
    expect(msUntilAbandon(sessionWith(hoursAgo(48), hoursAgo(48)))).toBeGreaterThan(0);
    expect(msUntilAbandon(sessionWith(hoursAgo(500), hoursAgo(500)))).toBe(0);
  });
});

describe("lastWorkAt", () => {
  it("null when nothing was ticked — an empty session never dates a day", () => {
    expect(lastWorkAt(sessionWith(hoursAgo(1)))).toBeNull();
  });

  it("the newest working set's timestamp", () => {
    const s = sessionWith(hoursAgo(4), hoursAgo(3));
    s.exercises[0].sets.push({ weightLb: 110, reps: 8, rpe: 8, done: true, skipped: false, doneAt: hoursAgo(2) });
    expect(lastWorkAt(s)).toBe(hoursAgo(2));
  });

  it("dates the day by the training, not by the record's start", () => {
    // The shape of the one legacy production record: started a week ago, but
    // the sets were actually lifted yesterday. "Last done" must say yesterday.
    const s = { ...sessionWith(hoursAgo(168), hoursAgo(20)), finishedAt: hoursAgo(19) };
    expect(lastWorkAt(s)).toBe(s.exercises[0].sets[0].doneAt);
    expect(lastWorkAt(s)).not.toBe(s.startedAt);
  });

  it("ramp sets alone are not a workout", () => {
    const s = sessionWith(hoursAgo(2), hoursAgo(1));
    s.exercises[0].sets[0].warmup = true;
    expect(lastWorkAt(s)).toBeNull();
  });

  it("a skipped exercise's rows do not count", () => {
    const s = sessionWith(hoursAgo(2), hoursAgo(1));
    s.exercises[0].skipped = true;
    expect(lastWorkAt(s)).toBeNull();
  });

  it("falls back to the start for sets logged before doneAt existed", () => {
    const s = sessionWith(hoursAgo(50));
    s.exercises[0].sets[0].done = true;
    delete s.exercises[0].sets[0].doneAt;
    expect(lastWorkAt(s)).toBe(s.startedAt);
  });
});

describe("reapAbandoned", () => {
  it("closes only the open sessions that timed out", () => {
    const fresh = { ...sessionWith(hoursAgo(2), hoursAgo(1)), id: "fresh" };
    const paused = { ...sessionWith(hoursAgo(40)), id: "paused", pausedAt: hoursAgo(30) };
    const dead = { ...sessionWith(hoursAgo(200), hoursAgo(199)), id: "dead" };
    const closed = { ...sessionWith(hoursAgo(400), hoursAgo(399)), id: "closed", finishedAt: hoursAgo(398) };

    const reaped = reapAbandoned([fresh, paused, dead, closed]);

    expect(reaped.map((s) => s.id)).toEqual(["dead"]);
    // Dated by the last set, never by "now" — closing it today must not credit
    // today's date with a workout done last week.
    expect(reaped[0].finishedAt).toBe(lastActivityAt(dead));
    expect(reaped[0].autoClosed).toBe(true);
    expect(reaped[0].sessionFeel).toBeNull();
    expect(reaped[0].pausedAt).toBeNull();
  });

  it("dates a timed-out pause by the pause, not the start", () => {
    const s = { ...sessionWith(hoursAgo(300)), pausedAt: hoursAgo(100) };
    expect(reapAbandoned([s])[0].finishedAt).toBe(s.pausedAt);
  });
});

describe("resolveIncoming", () => {
  const closedAt = "2026-08-01T20:00:00.000Z";

  it("a queued offline write cannot reopen a closed session, but its sets land", () => {
    const existing: Session = {
      ...sessionWith(hoursAgo(200), hoursAgo(199)),
      finishedAt: closedAt,
      autoClosed: true,
    };
    const incoming: Session = {
      ...sessionWith(hoursAgo(200), hoursAgo(199)),
      finishedAt: null,
      pausedAt: hoursAgo(150),
      exercises: [
        {
          exerciseId: "bench",
          name: "Bench",
          skipped: false,
          sets: [{ weightLb: 155, reps: 5, rpe: 9, done: true, skipped: false, doneAt: hoursAgo(199) }],
        },
      ],
    };

    const merged = resolveIncoming(existing, incoming);

    expect(merged.finishedAt).toBe(closedAt);
    expect(merged.autoClosed).toBe(true);
    expect(merged.pausedAt).toBeNull();
    // The device was the one in the gym: its set data wins.
    expect(merged.exercises[0].sets[0].weightLb).toBe(155);
  });

  it("a genuine finish overrides an automatic close", () => {
    const existing: Session = { ...sessionWith(hoursAgo(50)), finishedAt: closedAt, autoClosed: true };
    const incoming: Session = {
      ...sessionWith(hoursAgo(50)),
      finishedAt: "2026-08-02T09:00:00.000Z",
      sessionFeel: "strong",
    };

    const merged = resolveIncoming(existing, incoming);

    expect(merged.finishedAt).toBe("2026-08-02T09:00:00.000Z");
    expect(merged.sessionFeel).toBe("strong");
    expect(merged.autoClosed).toBeUndefined();
  });

  it("leaves an open session alone, pause included", () => {
    const existing = sessionWith(hoursAgo(3));
    const incoming = { ...sessionWith(hoursAgo(3)), pausedAt: hoursAgo(1) };
    expect(resolveIncoming(existing, incoming)).toEqual(incoming);
  });
});

describe("newSession units", () => {
  const day: ProgramDay = {
    id: "day-a",
    name: "Day A",
    exercises: [
      { id: "back-squat", name: "Back squat", targetSets: 2, targetReps: 5, targetRPE: 8, seedWeight: 60, seedIsGuess: false },
    ],
  };
  const past = (unit: Session["unit"], weightLb: number): Session => ({
    id: "history",
    dayId: day.id,
    dayName: day.name,
    startedAt: hoursAgo(48),
    finishedAt: hoursAgo(47),
    sessionFeel: null,
    ...(unit ? { unit } : {}),
    exercises: [
      {
        exerciseId: "back-squat",
        name: "Back squat",
        skipped: false,
        sets: [{ weightLb, reps: 5, rpe: null, done: true, skipped: false }],
      },
    ],
  });
  const weights = (s: Session) => s.exercises[0].sets.map((set) => set.weightLb);

  it("records the program's unit", () => {
    expect(newSession(day, [], "kg").unit).toBe("kg");
  });

  it("ignores history logged in the other unit and falls back to the seed", () => {
    expect(weights(newSession(day, [past("lb", 160)], "kg"))).toEqual([60, 60]);
  });

  it("pre-fills from history logged in the same unit", () => {
    expect(weights(newSession(day, [past("kg", 70)], "kg"))).toEqual([70, 70]);
  });

  it("pre-fills from legacy history without a unit", () => {
    expect(weights(newSession(day, [past(undefined, 160)], "lb"))).toEqual([160, 160]);
  });
});
