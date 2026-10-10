"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { applyPendingUpdate, checkForUpdate, holdUpdate } from "@/lib/appupdate";
import { onPatchesSettled } from "@/lib/localsync";

/**
 * Checks for an app update on load, when the app becomes visible again and on
 * reconnect, and applies a pending one once the page allows it (lib/appupdate.ts).
 */
export function UpdateCheck() {
  const pathname = usePathname();

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") void checkForUpdate();
    }
    function onOnline() {
      void checkForUpdate();
    }
    void checkForUpdate();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    // Deferred by one task so a caller draining several sessions (flushDirty)
    // queues its next PATCH, or records the ack, before the gate is read.
    const stopListening = onPatchesSettled(() => setTimeout(applyPendingUpdate, 0));
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      stopListening();
    };
  }, []);

  // Leaving a session by client navigation lets a waiting update apply.
  useEffect(() => {
    applyPendingUpdate();
  }, [pathname]);

  return null;
}

/** Hold app-update reloads while `busy` (overview start, confirm, close-out). */
export function useUpdateHold(busy: boolean): void {
  useEffect(() => (busy ? holdUpdate() : undefined), [busy]);
}
