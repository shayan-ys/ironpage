"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { flushDirty, hasPending } from "@/lib/localsync";

/**
 * Drains the offline outbox on every page load, on reconnect and whenever the
 * app comes back to the foreground, then refreshes the router so server
 * components re-read the result.
 *
 * Without this, a finish PATCH lost to backgrounding or no signal was only
 * retried when that session's own page was reopened — the overview kept
 * offering "Resume" on a workout that was finished days earlier. The
 * foreground drain matters because iOS suspends a standalone PWA rather than
 * reloading it: a finish whose PATCH failed as the phone locked otherwise
 * waits for a reload or an `online` event that may never come, and the server
 * keeps the session open.
 *
 * Never refreshes on a session page: after a deploy, Next turns a refresh from
 * old code into a full reload, and an app update must not reload a session
 * (lib/appupdate.ts). The session page renders from its own local copy anyway.
 */
export function SyncOnLoad() {
  const router = useRouter();
  useEffect(() => {
    let alive = true;
    function drain() {
      if (!hasPending()) return;
      void flushDirty().then(() => {
        const onSession = window.location.pathname.startsWith(`${process.env.GYM_BASE_PATH ?? ""}/session/`);
        if (alive && !hasPending() && !onSession) router.refresh();
      });
    }
    function onVisible() {
      if (document.visibilityState === "visible") drain();
    }
    drain();
    window.addEventListener("online", drain);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.removeEventListener("online", drain);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);
  return null;
}
