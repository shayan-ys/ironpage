# Ironpage

Single-user workout-logging PWA built with the Next.js App Router. It stores JSON
blobs. These notes preserve behaviors that affect saved workouts, offline
recovery, and local development.

## Program source

`getProgram()` in `lib/store.ts` returns the stored `program.json`, or null when
none is stored. Nothing is seeded automatically. With no program, the overview
shows the first-run picker (`components/StarterPicker.tsx`): one card per
starter in `lib/starter-programs/`, an lb/kg toggle, and a button that builds
the starter in that unit and stores it with `PUT /api/program`. Until then
`GET /api/program` returns 404 and `POST /api/session` returns 409. Once a
program is stored, editing a starter file does not change it.

Update the active plan through the API; this takes effect without a deploy:

```bash
curl -X PUT https://<host>/api/program \
  -H "x-gym-secret: $GYM_SECRET" \
  -H 'content-type: application/json' \
  -d @program.json
```

Starter programs have no `targets`: a ladder's dated steps would already be in
the past for anyone who picks the starter later. Their loads are written per
unit by hand, not converted.

`ProgramDay.warmup` (`total`, `note`, `drills`) feeds the warm-up card at the
top of a session. Sessions do not copy it; the session page passes the current
program day's warm-up, and the card hides when the day has none.

## Local development

Do not run `npm run dev` with the production token loaded: `lib/store.ts` selects
Vercel Blob whenever `BLOB_READ_WRITE_TOKEN` is set, so development would read
and write real workout data. Clear both variables to use `.data/` and disable the
local login gate:

```bash
BLOB_READ_WRITE_TOKEN= GYM_SECRET= npx next dev --port 3111
```

Seed local test data by POSTing to `/api/session`; remove it with
`rm -f .data/sessions/*.json`.

Stop `next dev` before running `next build`, because both commands share `.next`
and can replace each other's chunks. If this produces
`MODULE_NOT_FOUND: Cannot find module './331.js'` or a route returns a bare 500,
stop development, remove `.next`, build, then restart. Renaming a module while
development is running can cause the same failure.

## Storage and synchronization

- `program.json` stores the plan, one per environment. `sessions/<id>.json`
  stores each workout; `id` is the ISO start timestamp with `:` and `.` replaced
  by `-`.
- `BLOB_READ_WRITE_TOKEN` selects Vercel Blob when set and `.data/` otherwise.
- Clients are offline-first: mutations write to `localStorage` synchronously and
  PATCH opportunistically via `lib/localsync.ts`. The client PATCHes the whole
  session and the server uses last-write-wins, except for its closure rule below.
- PATCHes use `keepalive` so backgrounding the PWA after finishing cannot cancel
  the write. They are serialized per session ID so an older request cannot land
  after the finish request and reopen the session.
- The server keeps its own closure state. `resolveIncoming` in `lib/defaults.ts`,
  applied by the PATCH route, accepts client set data but will not let
  `finishedAt: null` replace a `finishedAt` already stored by the server. This
  prevents an offline phone from reopening a session the server timed out while
  it was disconnected.
- The device copy is authoritative until the server acknowledges it.
  `locallyFinished` hides the resume banner and removes “Resume →” when a workout
  finished without signal. Free the local copy when either side reports the
  session closed; a leftover copy can bring the banner back.
- `SyncOnLoad` in the root layout drains the dirty outbox on every page load and
  reconnect. Without it, a lost finish would be retried only by reopening that
  session's page.
- Retry failed PATCHes except for 404 and 400: those mean the record is gone or
  the body cannot be accepted, and retrying would pin the outbox and sync badge
  open. Keep 401 and 5xx queued so an expired cookie does not discard a workout.

## Session lifecycle

Keep the three exits distinct:

| Exit | Stored state | Trigger |
| --- | --- | --- |
| Pause | `pausedAt = now`; session stays open | “Pause” in the finish bar |
| End / finish | `finishedAt = now` plus session feel | “Finish workout” / “End workout” |
| Time out | `finishedAt = lastActivityAt`, `autoClosed: true` | `reapAbandoned`, on read |

- Any edit clears `pausedAt`; `mutate` nulls it before running the callback so
  resumed sessions are not still marked paused.
- Both thresholds in `lib/defaults.ts` use `lastActivityAt`, the newest logged
  set, warm-up tick, or pause rather than the current time. `STALE_AFTER_MS` is
  24 hours and prompts before silently resuming; `ABANDON_AFTER_MS` is 72 hours
  and closes the session.
- `getOverview` in `lib/store.ts` is the only reap site and reaps as part of
  reading. It returns retired sessions in the same list as active ones so the
  overview can report “last done” on that load rather than waiting for a second
  load. There is no cron.
- Date abandoned sessions by `lastActivityAt`, not now: using now can assign the
  workout to the wrong day and inflate its duration (one case changed 66 minutes
  into 16 hours).
- A session without a working set cannot claim the day. `hasLoggedWork` gates
  `lastByDay` so an abandoned start or timed-out empty session does not say
  “Last done today”.
- Repeating a day creates a separate record. Resuming a 10-day-old session once
  merged two performances and required every set to be unchecked and checked
  again.
- Starting a session requires the server because it creates the ID and seeded
  weights from past sessions. `DayCard` reports a failed POST rather than
  staying on “Starting…”. Pausing, ending, and finishing work offline.

## Session data

`GYM_READ_SECRET` is GET-only: it permits `GET /api/session/<id>` and `GET /api/program`.

`LoggedSet.warmup?: boolean` marks a ramp set. Exclude ramp sets from working
volume, session and exercise completion, the “last” reference row, and
`lastWeightsFor`, which seeds the next session. Including a 50% ramp set there
would lower the program's weights each week. Check all `warmup` aggregations
when adding a set calculation.

`ProgramExercise.targets?: TargetStep[]` floors the pre-fill with a dated
ladder. The step with the latest `from` at or before the session start applies:
each set pre-fills `max(lastWeightsFor value, step.weightLb)` when the step has
a weight, or history then `seedWeight` for a weightless step; `step.reps`
replaces `targetReps` and `step.sets` overrides `targetSets` while that step
applies. A later step without `sets` returns to `targetSets`. Write `from` with an
offset (`2026-10-06T00:00:00-04:00`); a bare date parses as UTC midnight and
turns the week during an evening session west of UTC. Before the first step, history
then `seedWeight` apply. Leave targets off "find" lifts, where the guess must
not floor a lighter real load. Keep an exercise's `id` when a lift continues
across program versions; a new id starts with no history.

`ProgramExercise.rampSets?: { weightLb, reps }[]` plans ramp sets explicitly;
a `TargetStep.rampSets` replaces the list while that step applies, so ramp
loads follow a weekly ladder. `buildSessionExercises` copies the active list
into leading `warmup: true` rows at session start; the app never computes a
ramp prescription, and resuming a session never reseeds it. Exercise notes and
the warm-up card do not restate ramp counts: the rows carry them. Manual
add/remove of ramp rows stays.

Units: `Program.unit` is `"lb"` or `"kg"`. Every weight number (`seedWeight`,
`weightLb` on targets, ramp sets and logged sets) is stored in that unit with
no conversion, and the `Lb` suffix on the field names is historical, so do not
rename the stored fields. The session page passes the current program's unit
to `SessionClient`, which feeds the weight label, the propagate prompt and the
notes sheet. Never hardcode "lb" in UI text. Ramp
rounding is unit-aware (`RAMP_STEP` in `lib/rampsets.ts`: 2.5 lb, 1.25 kg), so
pass the unit to `buildRampSet`. Changing a program's unit converts nothing.
`newSession` stamps `Session.unit` from the program, and `historyIn` keeps
sessions logged in another unit out of the pre-fill and the `lastFor`
reference row; a session without `unit` predates the field and counts as the
current program's unit.

`Session.warmupDoneAt?: string | null` timestamps the general warm-up card and
marks the preparation/work boundary. `Session.pausedAt?: string | null` records
an intentional pause, and `Session.autoClosed?: boolean` marks the app's 72-hour
timeout. All fields are optional because older sessions lack them; code treats
absence as `false` or `null`.

RPE is rated per exercise in `SessionExercise.rpe`, not per set. The change was
made in 2026-08 because the program prescribes one target per exercise and a
fixed load naturally increases effort across sets; three per-set ratings
answered a question asked once. `LoggedSet.rpe` is legacy data: keep reading
values from older sessions, but do not write new ones. Readers fall back to
`max(set.rpe)` for those sessions; `lastFor` in `lib/page-data.ts` does
this.

`Session.muscleImpact` is derived, not entered: `putSession` recomputes it on
every server write (`withStoredMuscleImpact` in `lib/muscles.ts`) for finished
sessions with muscle snapshots and drops it otherwise, so edits after finishing
and the 72-hour timeout keep it in step with the log. Each completed working set
adds muscle score × effort weight (exercise RPE 6 → 0.5, 7 → 0.7, 8 → 0.85,
9–10 → 1; unrated counts as 8). The map and chips colour it on a fixed scale,
2 units per level with level 5 from 8, and recompute from the log at render.
It is the dose for muscle readiness.

Muscle readiness (`/recovery`, the header body icon, and the day-card hint) is
computed on read, never stored, and has no cron. `muscleReadiness` in
`lib/muscles.ts` sums each session's impact from the last 7 days, halved every
18 h (`RECOVERY_HALF_LIFE_H`) since its newest working set (`lastWorkAt`), not
`finishedAt`: a session left open, paused overnight or timed out would
otherwise read as freshly trained. Fatigue of 8 units reads 0%,
and the same 8 is where the heat map reaches level 5, so both maps agree. A
muscle counts as ready at 90% or more: it is uncoloured on the map and drops out
of the card hint, which names up to two of the least-ready muscles the day
scores at 0.75 or more. Percentages are floored so a coloured muscle never
reads 90%. Pages pass doses; `useReadiness` computes after mount
with the device clock, so a service-worker-cached page still decays correctly
and hydration never sees a server percentage. It adds workouts finished on this
device that have not synced (`unsyncedFinished`), recomputing their impact
because a copy edited offline still carries the server's old `muscleImpact`.
The half-life and the 90% ready threshold are judged constants, not measured ones.

The card's notes pill opens a sheet with the worked muscles on top, then Last
time (the exercise note) above
one labelled list: the program note's rows (`ProgramExercise.notes`, free
labels), Weeks and Then, each only when present. Weeks is built from `targets`
as of the session start (`lib/program-notes.ts`): one chip per step with its
weight floor, ×reps on every chip when the effective reps (`step.reps ??
targetReps`) differ between steps, and the applying step highlighted. Then is
`ProgramExercise.then`. `PUT /api/program` rejects an exercise without note
rows and any leftover string `note`. Last time comes from the most recent
earlier session that included the exercise id, even one that skipped it
(`lib/notes.ts`); that can differ from the `lastFor` reference row, and an
empty note there shows nothing rather than an older note. It is read at render;
history is never changed.

The worked muscles come from the session exercise's `muscles` snapshot, so the
pill also shows when only scores exist. `components/MuscleFocus.tsx` draws one
MuscleMap view (more score wins; front on a tie) and crops its viewBox to the
muscles in that view scoring at least half its top score, padded, 300–450 map
units tall (a taller focus centres on the top-scoring muscles), and widened to
the area left of a large faint FRONT/BACK word at the frame's right (the body is
pinned left so the word never covers it). The crop is measured with `getBBox` in a
layout effect, so the full figure never paints first. Focus muscles pulse after
the sheet's 180 ms slide; reduced motion keeps them still.

## Settings, program upload and auth

`/settings` (the gear beside the readiness icon on the overview) replaces the
program with a starter from `lib/starter-programs` or pasted JSON, downloads the
program, exports all data, copies an AI prompt (`lib/program-prompt.ts`) that
points at `/program.schema.json`, and sets the form-video app
(`VIDEO_BRAVE_KEY` in `lib/site.ts`). Every replacement goes through the shared
`ConfirmSheet`, which counts current exercise ids the new program drops: an id
that changes starts with no history.

`validateProgram` in `lib/program-validate.ts` is the only program check. The
settings page runs it before upload and `PUT /api/program` runs it again,
answering 400 with `{ error, errors }`, one `path: problem` string each.
Unknown fields are refused so a misspelt field cannot drop silently. Exercise
ids may repeat across days but not within one; day ids are unique.
`public/program.schema.json` (draft-07) states the same shape for tools; when
a program field changes, change both, and `tests/program-validate.test.ts`
checks starters and invalid programs against each. The middleware serves the
schema without login so an AI assistant can read it.

`PUT /api/program` and `GET /api/export` accept the `x-gym-secret` header, or
the login cookie on a same-origin request (`checkSecretOrSession` in
`lib/auth.ts`: `Sec-Fetch-Site: same-origin`, else an `Origin` matching the
host). A request with the cookie and neither header is refused; scripts use
the header. `DELETE /api/session/<id>` stays header-only. The login cookie is
`Secure` only when the request arrived over HTTPS (`x-forwarded-proto` or the
URL), so a plain-HTTP LAN self-host can still log in.

## Service worker

`public/sw.js` is network-first for navigations and RSC payloads, and
stale-while-revalidate for static assets. Client navigation to a `force-dynamic`
page fetches `/?_rsc=…`, which is not `req.mode === "navigate"`; without an RSC
check, the payload enters stale-while-revalidate and can replay indefinitely,
showing a finished workout as resumable. Bump `CACHE` when caching behavior
changes; `activate` removes older cache names.

`PwaInit` registers the worker only in production and removes development
registrations and their caches. The service worker's stale-while-revalidate
branch can otherwise serve `/_next/` chunks from the previous build after
development recompiles.

## iOS constraints

- Keep every text-entry control at least 16px because smaller text makes Safari
  zoom on focus without zooming back out. `.usernote` uses 16px for this reason.
- The manifest uses `display: standalone` and a translucent status bar, placing
  the page under the Dynamic Island. Put the safe-area inset on sticky elements'
  `padding-top`, not `top`; a `top` offset leaves a gap with content scrolling
  through it.
- Do not set `maximum-scale` or `user-scalable`: that would disable pinch zoom
  for accessibility. The 16px rule prevents automatic focus zoom instead.

## UI invariants

Set cards have fixed height. The exercise RPE control swaps chip and tap stops
within the same-height row because an expanding drawer once moved the page between
`pointerdown` and `click`, sending a tap intended for “＋ note” to “skip this
exercise”. Do not add an outside-tap close handler; it can reintroduce that
interaction bug.

The set-done control stays a native `<input switch>` because it buzzes on
iPhone. WebKit bug 321591 makes a drag that starts on it toggle it, so
the app decides the tick 60 ms after `change` (`components/useVetoedSwitch.ts`) and
drops it if that touch was cancelled or moved more than 10 px. Every accepted tick
or un-tick flashes a green ring; a vetoed one does not. A `hapticRef` button
(below) would also buzz and is scroll-safe, but swapping the switch for one is
an undecided change, not a cleanup. The warm-up card's switch uses the same
veto. Revisit when an iOS release ships WebKit PR 71769.

Every button and link takes `ref={hapticRef}` and a `data-haptic` kind
(`lib/haptics.ts`): `selection` opens a picker, sheet or disclosure; `light`
is a small edit; `medium` is navigation or a commitment; `heavy` a destructive
confirm; `warning` closes something out; `success` finishes a workout. Android
plays each kind's vibration pattern; RPE picks play `rpeHaptic`, longer per
step. An iPhone plays one fixed tick for every kind: since iOS 26.5 a switch
ticks only on a trusted tap, so strength, duration and repeats are out of
reach. The ref lays a transparent `<label>` wired to a hidden switch over the
element, never the switch itself, because a touch that starts on a switch
cannot scroll the page. The label stops the tap's click and re-clicks the host,
so an `<a>` still navigates and `<Link>`'s `preventDefault` cannot cancel the
tick.

Surfaces with many targets use `hapticZoneRef` instead: `PinchZoom` lays one
label over the readiness map, finds what is under the finger, and clicks it.
The iPhone ticks only when that click's handlers call `haptic()`. A muscle tap
plays `levelHaptic` (hotter muscles buzz harder on Android); a tap beside the
body plays `selection` only when it clears a pick, and a tap that changes
nothing stays silent. Pinch detents at 1× and 4× buzz on Android only, because
a pinch is not a tap. A control inside the zone needs a z-index above the label
(`.zoomreset` has one).

Working sets complete in order within one exercise (`canCompleteSet` in
`lib/set-order.ts`): a row's done switch is `disabled` until every earlier
working row is done or skipped, so an out-of-order tap gives no buzz, flip or
ring. `toggleDone` re-checks the same rule. Ramp rows complete in any order,
and un-ticking a done row is always allowed. Supersets are unaffected because
the rule never looks across exercises.

The RPE control is five switch-backed tap stops (6–10) in the fixed-height RPE
row. Each hidden switch is clipped to its own stop, so a tap never lands on a
neighbour; the row is a scroll dead spot by design; feedback is the fixed switch
buzz only, with the same veto as the set-done control. Android also plays
`rpeHaptic` for the picked stop.

The finish sheet opens itself once, when every working set is done or
skipped. When that last tick opened the exercise's RPE stops, it waits for a
stop to be picked and opens 600 ms later; until then “Finish workout” in the
finish bar opens it. Popping it at once covered the final lift's stops.

The RPE palette is keyed by `data-rpe` (the `[data-rpe]` rules in
`app/globals.css`): every RPE surface must set it, through `rpeStop` in
`components/RpeSlider.tsx`, which rounds a rating and clamps it to 6–10.

Every scroll to a set puts the row's centre at 40% of the screen height
(`FOCUS_LINE` in `components/setFocus.ts`). The page scrolls to a set in three
places only. Opening a session jumps to the current set, unless nothing is
logged yet (no warm-up tick, no set ticked or skipped): a fresh session stays at
the top so the warm-up card comes first. When the current set is fully off
screen, a green arrow pill (`components/CurrentSetPill.tsx`) sits under the
progress bar or above the rest bar, pointing at it; tapping it glides there. The
superset hand-off (`components/SupersetScroll.tsx`): ticking the current set so
that a different member of the same superset becomes current smooth-scrolls 300
ms after the accepted tick, unless the partner is already comfortably on screen.
Any touch, wheel, key or >24 px scroll cancels it during the delay. During any
glide, a touch stops it and swallows that click within 600 ms. The current set
is computed from the log (`lib/supersets.ts`), never picked by hand.

Rest is derived from the log, not stored (`lib/rest.ts`): the newest-`doneAt`
rest-relevant set owns the rest; only a Skip is kept, in `localStorage`. The rest
bar and Skip button are fixed at the bottom. The end alarm (flash, looping chime,
10 s cap, touch-to-stop capture layer) is one implementation,
`components/EndAlarm.tsx`, shared by the rest end and the hold end; an end
reached while hidden or delivered over 3 s late is silent, and hiding the page
silences a sounding alarm (`lib/alarm.ts`). After a touch stops an alarm or
cancels a hold, the capture layer stays up and swallows every pointer and click
until 500 ms after the last finger on it lifts, so the stopping tap and a quick
second tap never land on the page underneath. The 10 s cap and a click with no
pointerdown (assistive activation, which also stops the alarm or cancels the
hold) arm the same 500 ms guard.

`ProgramExercise.timed?: boolean` (snapshotted into `SessionExercise.timed` at
session start; `PUT /api/program` rejects a non-boolean) marks an exercise
measured in seconds: each row's `reps` is the hold length, and its wheel reads
"sec" and runs to `HOLD_MAX_SECONDS` (120). Its rows get a ▶ (`.holdstart`)
inside the seconds column, beside the length it runs, enabled by `canStartHold` (`lib/hold.ts`: open row, seconds > 0,
`canCompleteSet` allows it). Tapping it unlocks audio, takes the screen lock
(`holdTimerWakeLock`, a flag separate from the rest's) and opens the
full-screen hold countdown (`components/HoldTimer.tsx`), clocked from an
absolute `endsAt`. Any touch cancels it with the set untouched. At zero the
set is ticked through `toggleDone` with `doneAt` = `endsAt` (RPE default,
superset hand-off and rest priming included), then the end alarm sounds; the
exercise's rest runs from that `doneAt`. A rest that ends while the countdown
or its alarm is up ends silently. The running hold is React state only, not
persisted: a reload or iOS evicting the page discards it and leaves the set
unticked.

Every bottom sheet (confirm, finish, the overview's close-and-start prompt) is
the shared modal `components/Sheet.tsx` on Base UI Drawer (`@base-ui/react`,
pinned). Modality is required: it locks page scroll and keeps set switches
underneath from firing. Because a modal drawer marks everything outside its
portal hidden and covers it with its backdrop, the rest layers render inside the
open sheet's portal (`SheetLayerHost`), above the sheet; touching them is not a
backdrop press, so Skip and the alert's first touch never close the sheet. Base
UI closes a swiped sheet past half its height or on a fast flick.
