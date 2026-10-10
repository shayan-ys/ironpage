"use client";

import { useEffect } from "react";

/**
 * Registers the service worker so the app opens offline (see public/sw.js).
 * Client-only; a no-op where service workers aren't supported.
 *
 * Production only, deliberately. The worker's stale-while-revalidate branch
 * caches `/_next/` chunks, which is right for a gym with no signal and wrong
 * for local development: it will happily serve the previous build's JavaScript,
 * so you edit a component, the dev server recompiles, and the page keeps
 * running the old code. Any worker left over from an earlier run is torn down
 * along with its caches, since an already-installed one would keep doing this
 * even after registration stops.
 */
export function PwaInit() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => {});
      if (typeof caches !== "undefined") {
        void caches
          .keys()
          .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
          .catch(() => {});
      }
      return;
    }

    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // best-effort — offline is a bonus, never block the app on it
    });
  }, []);
  return null;
}
