"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MUSCLE_LABELS, RECOVERY_HALF_LIFE_H, type ReadinessDose } from "@/lib/muscles";
import { MUSCLE_IDS, type MuscleId } from "@/lib/types";
import { haptic, hapticRef } from "@/lib/haptics";
import { useReadiness } from "./useReadiness";

// The geometry is ~45 KB, so it loads only when a map is actually shown.
const MuscleMap = dynamic(() => import("./MuscleMap"), { ssr: false });

/** How many of the least-ready muscles the whole-body line names. */
const SUMMARY_COUNT = 3;

/**
 * Full-body readiness: the remaining fatigue per muscle on the session heat
 * scale. Tapping a muscle shows its number; tapping anywhere else on the page
 * returns to the whole-body line.
 */
export function RecoveryClient({ doses, back }: { doses: ReadinessDose[]; back: string }) {
  const readiness = useReadiness(doses);
  const [selected, setSelected] = useState<MuscleId[] | null>(null);

  let line: string | null = null;
  let detail: string | null = null;
  if (readiness && selected) {
    line = selected.map((m) => `${MUSCLE_LABELS[m]} ${readiness[m].readiness}%`).join(" · ");
  } else if (readiness) {
    const tired = MUSCLE_IDS.filter((m) => readiness[m].level > 0).sort(
      (a, b) => readiness[a].readiness - readiness[b].readiness,
    );
    const named = tired.slice(0, SUMMARY_COUNT).map((m) => `${MUSCLE_LABELS[m]} ${readiness[m].readiness}%`);
    line = tired.length === 0 ? "Every muscle is ready" : `Most tired: ${named.join(" · ")}`;
    detail = `${MUSCLE_IDS.length - tired.length} of ${MUSCLE_IDS.length} muscles ready (90%+). Tap a muscle for its number; pinch to zoom.`;
  }

  return (
    <main
      className="recoverypage"
      onClick={(e) => {
        // A tap beside the body clears the pick; it buzzes only when there was
        // one to clear, and never on top of a control's own buzz.
        if (selected && !(e.target as Element).closest("a, button")) haptic("selection");
        setSelected(null);
      }}
    >
      <header className="shead">
        <Link className="back" href={back} ref={hapticRef} data-haptic="medium">
          ← back
        </Link>
        <div className="kicker">Recovery</div>
        <h1>Muscle readiness</h1>
        <p className="subtle">
          Workouts in the last 7 days, each fading by half every {RECOVERY_HALF_LIFE_H} h.
        </p>
      </header>
      <section className="recovery">
        {readiness === null && (
          <p className="subtle">No finished workout with muscle data in the last 7 days.</p>
        )}
        {readiness && (
          <>
            <MuscleMap
              levels={Object.fromEntries(Object.entries(readiness).map(([m, r]) => [m, r.level]))}
              label="muscle readiness map"
              legend={["Recovering", "Spent"]}
              onSelect={setSelected}
              selected={selected ?? []}
              zoomable
            />
            <p className="recovery-pick" aria-live="polite">
              {line}
            </p>
            {detail && <p className="recovery-detail">{detail}</p>}
          </>
        )}
      </section>
    </main>
  );
}
