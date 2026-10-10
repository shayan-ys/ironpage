# Security policy

## Reporting a vulnerability

Please report security problems privately. Do not open a public issue.

Use GitHub's private vulnerability reporting: open the repository's **Security**
tab and choose **Report a vulnerability**
(<https://github.com/shayan-ys/ironpage/security/advisories/new>). Include
what you found, how to reproduce it, and the version or commit.

This is a hobby project with one maintainer. Expect a first reply within about a
week. Fixes for confirmed problems ship as a patch release, and you will be
credited in the advisory unless you ask not to be.

## Supported versions

Only the latest release and the `main` branch get security fixes.

## Threat model

Ironpage is a **single-user** app. One person runs one deployment and logs their
own workouts. It has no accounts, roles or per-user data. Anyone who can sign in
can read and change everything.

What the app protects, and how:

- **Shared secret (`GYM_SECRET`).** One password for the whole deployment.
  `middleware.ts` puts every route except `/login`, `/api/login` and the PWA
  shell assets (service worker, manifest, icons, `/_next/` files) behind it. If
  `GYM_SECRET` is unset the gate is off. That is meant for local development
  only. Never expose an instance without it.
- **Login cookie.** After a correct password, `/api/login` sets an `HttpOnly`,
  `SameSite=Lax` cookie that holds the SHA-256 hash of the secret and lasts a
  year. The cookie is the credential: anyone who holds it is signed in until you
  change `GYM_SECRET`. Changing the secret signs out every device. The cookie is
  marked `Secure` when the request arrives over HTTPS (directly or with
  `X-Forwarded-Proto: https`), so plain HTTP on a LAN still works, but the
  cookie then travels unencrypted. Put a TLS-terminating reverse proxy in front
  of a self-hosted instance.
- **Header access.** Scripts send the secret in the `x-gym-secret` header.
  `DELETE /api/session/:id` accepts only that header. `PUT /api/program` and
  `GET /api/export` accept the header, or the login cookie on a same-origin
  request (`Sec-Fetch-Site: same-origin` or a matching `Origin`), so the
  Settings page can use them while a cross-site request carrying the cookie is
  refused. The session routes the app uses (start, read, save) accept the
  cookie.
- **Read-only secret (`GYM_READ_SECRET`).** Optional. A second value that works
  only as an `x-gym-secret` header on `GET /api/program` and `GET
  /api/session/<id>`. Use it to let a read-only tool, such as a coach or
  assistant, see a workout without the power to change or delete data. It cannot
  list sessions or export everything. It is not accepted for any other route,
  and it never falls through to full access.
- **Blob storage.** With `BLOB_READ_WRITE_TOKEN` set, data lives in a Vercel
  Blob store. Create it as a **private** store (`BLOB_ACCESS=private`, the
  default) so the files are readable only with the token. A public store gives
  every file a URL that anyone can open if they know or guess it; use that only
  for existing public stores. Treat the token like a password: with it, someone
  can read and overwrite all your workouts. Without the token, data lives in
  `.data/` on the server's disk, protected by whatever protects that disk.
- **Comparisons and timing.** The secret is compared directly and there is no
  rate limiting on `/api/login`. Choose a long random `GYM_SECRET`, and add rate
  limiting at your proxy if the instance is on the public internet.

Out of scope:

- Multiple users, or isolating one user's data from another's.
- Anyone who already has the secret, the cookie, the Blob token, or access to the
  server's disk.
- Data on a lost or shared phone: workouts are cached in the browser's
  `localStorage` and service-worker cache.
- Denial of service against a small self-hosted instance.

## Keeping an instance safe

- Set `GYM_SECRET` to a long random value, and serve the app over HTTPS.
- Keep `.env*` files out of version control. `.env.example` holds names only.
- Use a private Blob store, and rotate the token if it leaks.
- Back up `.data/` (or the Docker volume), or export with `GET /api/export`.
