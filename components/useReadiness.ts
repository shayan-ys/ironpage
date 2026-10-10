"use client";

import { useEffect, useState } from "react";
import { muscleReadiness, readinessDose, type ReadinessDose, type ReadinessMap } from "@/lib/muscles";
import { unsyncedFinished } from "@/lib/localsync";

/** How often an open page re-reads readiness; it changes slowly. */
const TICK_MS = 60_000;

/**
 * Readiness as of the device clock, from the server's recent doses plus any
 * workout finished on this device that has not synced. Computed after mount:
 * the server's clock and the cached render's age would both be wrong, and a
 * server-rendered percentage would not match hydration. `undefined` until
 * mounted; `null` when there is no recent data.
 */
export function useReadiness(doses: ReadinessDose[]): ReadinessMap | null | undefined {
  const [readiness, setReadiness] = useState<ReadinessMap | null | undefined>(undefined);
  useEffect(() => {
    const update = () => {
      // A device copy recomputes its impact: its stored value can predate an offline edit.
      const local = unsyncedFinished().flatMap((s) => readinessDose(s, false) ?? []);
      // Local copies go last so they replace the server's copy of the same id.
      setReadiness(muscleReadiness([...doses, ...local], Date.now()));
    };
    update();
    const timer = setInterval(update, TICK_MS);
    return () => clearInterval(timer);
  }, [doses]);
  return readiness;
}
