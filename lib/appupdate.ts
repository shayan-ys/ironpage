import { patchesUnsettled } from "./localsync";

/**
 * App update (GLOSSARY.md): a newer deployed build than the one running here.
 * It applies only outside a session, as a quiet reload with no notice.
 *
 * A deploy does not change `public/sw.js`, so service-worker lifecycle events
 * never fire for it; the build id is compared instead. The reload waits while
 * the overview is busy (a start, the close-and-start confirmation, a resume
 * close-out) and while any session PATCH is queued or in flight, since a
 * keepalive PATCH outliving the reload could land after the new page's flush
 * and overwrite newer sets. Waiting is always safe: the update stays pending
 * and applies at the next check.
 */

/** This build's id, compiled in by next.config.mjs. */
export const BUILD_ID = process.env.GYM_BUILD_ID ?? "";

// Remembers the remote id a reload was already tried for, so a server and
// client that disagree for any other reason cannot reload forever.
const TRIED_KEY = "gym:update-tried";

let holds = 0;
let pendingId: string | null = null;

/**
 * Whether a pending update may reload the page now. Never inside a session:
 * the update waits until the lifter leaves it.
 */
export function canApplyUpdate(pathname: string, busyHolds: number, unsettledPatches: boolean): boolean {
  return !pathname.startsWith("/session/") && busyHolds === 0 && !unsettledPatches;
}

/** Reload into the pending build if nothing on the page needs it to wait. */
export function applyPendingUpdate(): void {
  if (!pendingId || !canApplyUpdate(window.location.pathname, holds, patchesUnsettled())) return;
  try {
    if (sessionStorage.getItem(TRIED_KEY) === pendingId) return;
    sessionStorage.setItem(TRIED_KEY, pendingId);
  } catch {
    return;
  }
  window.location.reload();
}

/** Ask the server for its build id; mark an update pending when it differs. */
export async function checkForUpdate(): Promise<void> {
  if (!BUILD_ID || !navigator.onLine) return;
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return;
    const { buildId } = (await res.json()) as { buildId?: string };
    if (!buildId || buildId === BUILD_ID) return;
    pendingId = buildId;
  } catch {
    return;
  }
  applyPendingUpdate();
}

/**
 * Keep an app-update reload from interrupting overview work. Returns the
 * release; releasing the last hold retries a pending update after the current
 * render settles, so a hold dropped by navigating into a session is seen with
 * the session's path.
 */
export function holdUpdate(): () => void {
  holds++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds--;
    if (holds === 0) setTimeout(applyPendingUpdate, 0);
  };
}
