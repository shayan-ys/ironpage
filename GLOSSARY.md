# Ironpage

A single-user workout log that shows the day's program and records what was actually lifted.

## Language

**Program**:
The plan: the training days and the exercises each one prescribes.
_Avoid_: routine, plan file

**Planner**:
Whoever writes the program: the lifter, or a script or an AI assistant working for them. A planner's changes become a program revision only once the lifter approves them.
_Avoid_: planning agent, coach

**Program revision**:
A change to the program that the lifter has approved and that is now live.
_Avoid_: program update, regime change, new version

**Session**:
One performance of a program day, from start to finish.
_Avoid_: workout log, routine run

**Warm-up**:
The general preparation drills done once before the day's first exercise.
_Avoid_: warm-up set

**Ramp set**:
A lighter set at the front of an exercise, done to prepare for its working sets and never counted as work.
_Avoid_: warm-up set, warmup

**Working set**:
A set done to train rather than prepare, which counts toward working volume even when its load or reps differ from the prescription.
_Avoid_: work set, top set

**Superset**:
Two or more exercises whose sets are done alternately, one set of each in turn.
_Avoid_: circuit, pair

**Superset round**:
One working set of each superset member that still has working sets left, taken in program order; ramp sets are not part of any round.
_Avoid_: circuit lap, pass

**Current set**:
The set the log expects to be done next, worked out from what has already been logged rather than chosen by hand.
_Avoid_: active set, next set, selected set

**Rest period**:
The prescribed pause after a set before the next set begins.
_Avoid_: rest time, break

**Timed exercise**:
An exercise measured by how long a position is held rather than by repetitions; each set's reps field holds the seconds.
_Avoid_: iso exercise, duration exercise

**Hold timer**:
The full-screen countdown for one set of a timed exercise; it ticks the set when it reaches zero and then sounds the same end alarm as a rest period.
_Avoid_: iso timer, stopwatch, exercise timer

**Exercise time**:
The rough span from an exercise's first ticked set to its last, ramp sets included; a superset counts as one span.
_Avoid_: exercise timer, lift duration, time under tension

**Target muscle**:
A muscle group the program identifies as being trained by an exercise.
_Avoid_: body part

**Muscle score**:
A judged number from 0 to 1 for how much an exercise trains one of its target muscles, set by the planner rather than measured.
_Avoid_: muscle weight, muscle share, intensity, primary/secondary target

**Muscle impact**:
A session's per-muscle sum, over its completed working sets, of each set's muscle score times its effort weight; kept with the finished session.
_Avoid_: weighted set credit, stimulus, fatigue score

**Effort weight**:
How much a completed working set counts toward muscle impact, set by its exercise's RPE; harder sets count more.
_Avoid_: RPE multiplier, intensity

**Exercise note**:
What the lifter writes about one exercise in one session; the next session of that exercise shows it as "last time".
_Avoid_: setup line, user note, session note

**Program note**:
The planner's labelled rows for an exercise (`notes`), such as Setup, Log, Cue, Tempo or Swap: short phrases for setup, logging convention, form and swaps, read at a glance between sets. Never a copy of loads, set counts, RPE, rest or muscles the program already carries.
_Avoid_: plan note, exercise note, description

**Then line**:
The planner's one plain sentence for how to progress once an exercise's week steps run out, shown under Weeks in the notes sheet.
_Avoid_: progression rule, next step

**App update**:
A newer deployed build of the app than the one running on the phone; it takes effect only outside a session.
_Avoid_: new service worker, new version, refresh
