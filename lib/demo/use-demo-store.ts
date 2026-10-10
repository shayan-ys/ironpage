"use client";

import { useEffect, useState } from "react";
import { subscribe } from "./store";

/**
 * What a demo page renders from the browser store: `load`'s result, read after
 * mount (the store is localStorage, which the static export's prerender does
 * not have) and again after every store write, the way a server page is
 * re-read on refresh. `undefined` until the first read lands, and again
 * whenever `key` (what `load` reads, e.g. a session id) changes.
 */
export function useDemoStore<T>(load: () => Promise<T>, key = ""): T | undefined {
  const [state, setState] = useState<{ key: string; data: T }>();
  useEffect(() => {
    let alive = true;
    let latest = 0;
    function read() {
      const run = ++latest;
      void load().then((data) => {
        // Only the newest read lands, so a slow earlier one cannot overwrite it.
        if (alive && run === latest) setState({ key, data });
      });
    }
    read();
    const unsubscribe = subscribe(read);
    return () => {
      alive = false;
      unsubscribe();
    };
    // `key` names everything `load` reads; a new closure each render is not a new query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state?.key === key ? state.data : undefined;
}
