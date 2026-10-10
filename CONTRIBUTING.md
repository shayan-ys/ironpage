# Contributing

Issues and pull requests are welcome. Ironpage is a single-user, offline-first
workout logger, so the bar for a change is "does it keep saved workouts safe and
logging fast on a phone".

## Before you start

- Read [`AGENTS.md`](AGENTS.md). It records the rules that protect saved
  workouts: offline sync, how sessions open and close, ramp sets, and iOS
  haptics and switch quirks. A change that breaks one of them can lose or
  corrupt a workout.
- [`GLOSSARY.md`](GLOSSARY.md) defines the app's vocabulary (session, ramp set,
  target, readiness, and so on). Use those words in code, tests and UI copy.
- Stored data must stay readable. Existing `program.json` and `sessions/*.json`
  files must keep loading, so do not rename or remove stored fields. Add new
  fields as optional and treat absence as the old behaviour.

## Setup

You need Node.js 20.19+, 22.13+ or 24+ (the `engines` range in `package.json`).

```bash
git clone https://github.com/shayan-ys/ironpage.git
cd ironpage
npm install
BLOB_READ_WRITE_TOKEN= GYM_SECRET= npm run dev -- --port 3111
```

Open <http://localhost:3111>.

### Develop without env

With `BLOB_READ_WRITE_TOKEN` and `GYM_SECRET` both empty, the app:

- stores data as JSON files under `.data/` in the project root (`program.json`
  and `sessions/<id>.json`), which git ignores, and
- turns the login screen off.

The first run shows a picker of starter programs from `lib/starter-programs/`. Delete
`.data/` to start again, or `rm -f .data/sessions/*.json` to clear only the
workouts.

Do not run `npm run dev` with a real `BLOB_READ_WRITE_TOKEN` in your shell or
`.env.local`. Setting that token selects Vercel Blob, so development would read
and write your real workouts. Copy [`.env.example`](.env.example) only if you
want to try the Blob backend against a throwaway store.

Stop `next dev` before running `next build`. Both use `.next`, and each can
replace the other's chunks. If you see `MODULE_NOT_FOUND` or a bare 500, stop
the server, delete `.next`, and start again. To run two `next` processes in one
checkout, give each its own build directory: `NEXT_DIST_DIR=.next-other`.

### Try it on a phone

1. Put the phone and the computer on the same Wi-Fi network.
2. Start the dev server so it listens on all interfaces:
   `BLOB_READ_WRITE_TOKEN= GYM_SECRET= npm run dev -- --port 3111 --hostname 0.0.0.0`.
3. Find the computer's LAN address (for example `ipconfig getifaddr en0` on
   macOS) and open `http://<that address>:3111` on the phone.
4. To test the installed app, use Share, then Add to Home Screen. Install and
   offline behaviour need a production build (`npm run build && npm start`
   with the same empty variables), because the service worker registers only in
   production. Over plain HTTP on a LAN address, some browsers do not offer
   install or run the service worker; a tunnel with HTTPS works around that.

## Checks

Run these before you open a pull request. CI runs the same four.

```bash
npm run lint      # ESLint
npm test          # Vitest
npx tsc --noEmit  # type check
npm run build     # production build
```

Run a single test file with `npx vitest run tests/<file>.test.ts`. Tests cover
`lib/` logic. Put new domain logic in `lib/` with a test next to the existing
ones rather than inside a component.

If your change touches the UI, try it on an iPhone, installed to the Home
Screen, and say in the pull request what you tried. Simulators and desktop
browsers do not reproduce the haptics, safe-area or switch behaviour that
`AGENTS.md` describes.

## Pull requests

- **One change per pull request.** A bug fix, a feature, or a refactor, not a
  mix. Small pull requests get reviewed faster.
- Do not reformat or restyle code you are not changing.
- Update the docs, and add a line under "Unreleased" in
  [`CHANGELOG.md`](CHANGELOG.md), when users will notice the change.
- Fill in the pull request template.

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) with a short,
lower-case summary:

```
feat: add kg as a program unit
fix: keep a finished session closed after an offline edit
docs: explain the .data backend
perf: skip the muscle map recompute on unchanged logs
```

Other prefixes (`refactor:`, `test:`, `chore:`, `ci:`) are fine when they fit
better.

## Reporting problems

Open an issue with the bug template and include your device, OS version, and
whether the app was installed to the Home Screen. For a security problem, do not
open a public issue. See [`SECURITY.md`](SECURITY.md).

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
Contributions are licensed under the [MIT License](LICENSE).
