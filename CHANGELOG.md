# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-10-10

First public release.

### Added

- **Program-driven workouts.** The overview lists each day of the program with
  its lifts and when it was last done. Tapping a day starts a session.
- **Pre-filled sets.** Weights carry over from the last session of each lift,
  floored by an optional week-by-week target ladder (`targets`) that can also
  change sets, reps and ramp sets by date.
- **Ramp sets.** Planned ramp (warm-up) sets are logged as leading rows and never
  count as working volume, completion, or the weights that seed the next session.
  A general warm-up card marks the boundary between preparation and work.
- **One RPE per exercise.** Rated on five tap stops (6 to 10) in a fixed-height
  row.
- **Rest timer.** A bar at the bottom of the screen, derived from the log, with a
  Skip button. When it ends the screen flashes and an alarm loops until a touch
  or 10 seconds.
- **Supersets.** Detected from the log. Ticking a set scrolls to the partner
  exercise's next set. Working sets complete in order within an exercise.
- **Notes sheet.** Last time's note, the program's setup and form cues, the
  weekly targets with the current week highlighted, the worked muscles, and what
  to do next.
- **Form videos.** A button on each exercise opens a form search.
- **Finish screen.** How the session felt, how long it took, and a front and back
  muscle map weighted by effort.
- **Muscle readiness.** A recovery page, header icon and day-card hint computed
  from recent sessions with an 18-hour half-life. Nothing is stored and there is
  no cron job.
- **Offline-first sync.** Every change is saved on the phone first and sent to
  the server when there is signal. Requests are serialised per session, kept
  alive when the app is backgrounded, and retried until the server accepts them.
  A workout finished offline cannot be reopened by a stale copy.
- **Session lifecycle.** Pause, finish, and automatic close after 72 hours idle,
  dated by the last logged activity. A session idle for 24 hours asks before it
  resumes.
- **Haptics.** Every button and link buzzes through a native iOS switch, and
  Android gets graded vibration patterns. Scrolling from a button still scrolls.
- **Installable PWA.** Runs full-screen from the Home Screen, with a service
  worker for offline use and a quiet reload when a newer build is deployed.
- **Starter programs and first-run picker.** With no program stored, the
  overview offers ready-made starters (strength 5×5, full body, upper/lower,
  push/pull/legs) with an lb/kg toggle. Pick one, then change it to suit you.
- **Kilograms.** A program sets its unit (`lb` or `kg`), and every weight, label
  and ramp-set rounding step in the app follows it.
- **Settings page.** Replace the program from a starter or by pasting JSON that
  is validated before upload, download the program, export all data, copy an AI
  prompt that turns your own plan into valid JSON, and choose whether form
  videos open in Brave.
- **JSON Schema.** `program.schema.json` (draft-07) describes the program shape
  for editors and AI assistants. `PUT /api/program` validates the same rules and
  answers 400 with one message per problem.
- **Private Blob stores.** Vercel Blob storage works with private stores, which
  is the default (`BLOB_ACCESS=private`). Public stores keep working with
  `BLOB_ACCESS=public`.
- **Optional coach link.** Set `NEXT_PUBLIC_COACH_URL` to show a Coach button on
  an open session that links to a tool you host.
- **GitHub Pages demo.** A try-it-out version with made-up history that runs
  entirely in the browser, needs no sign-in and no setup, plus a landing page.
- **Scriptable JSON API.** Read or replace the program, read or save a session,
  and export everything, protected by a shared secret (`GYM_SECRET`). An optional
  read-only secret (`GYM_READ_SECRET`) allows `GET /api/program` and
  `GET /api/session/<id>` only.
- **Login gate.** One password for the whole app, stored as an `HttpOnly`
  cookie. Leave `GYM_SECRET` empty to turn it off for local use. The cookie is
  `Secure` only over HTTPS, so a plain-HTTP LAN install can still sign in.
- **Cookie auth for program upload and export.** The settings page uses the
  login cookie (same-origin requests only) to call `PUT /api/program` and
  `GET /api/export`. Scripts keep using the `x-gym-secret` header.
- **Storage backends.** Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set, or JSON
  files in `.data/` otherwise.
- **Self-hosting.** A `Dockerfile` and `compose.yaml` run the app as a non-root
  user with `.data/` on a named volume and a health check on `/api/version`.
- **Deploy to Vercel.** A one-click clone link on the landing page and in the
  README creates the project with a private Blob store.
- **Open-source project files.** CI (lint, tests, type check, build), Dependabot,
  issue and pull request templates, `CONTRIBUTING.md`, `SECURITY.md`, a code of
  conduct, and `.env.example`.

[Unreleased]: https://github.com/shayan-ys/ironpage/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/shayan-ys/ironpage/releases/tag/v1.0.0
