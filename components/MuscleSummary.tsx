"use client";

import dynamic from "next/dynamic";
import styles from "./MuscleSummary.module.css";
import { summarizeMuscleImpact } from "@/lib/muscles";
import type { Session } from "@/lib/types";

// The geometry is ~45 KB, so it loads only when a map is actually shown.
const MuscleMap = dynamic(() => import("./MuscleMap"), { ssr: false });

/**
 * Muscle impact of a finished session. `map`: the heatmap body map on the done
 * screen right after finishing. `chips`: the top muscles when a finished
 * session is reopened. Renders nothing for sessions without muscle snapshots
 * (unknown, not zero) or with no completed working sets.
 */
export function MuscleSummary({ session, mode }: { session: Session; mode: "map" | "chips" }) {
  const summary = summarizeMuscleImpact(session);
  if (!summary || summary.ranked.length === 0) return null;

  if (mode === "map") {
    return (
      <section className={styles.summary} aria-label="Muscle impact">
        <MuscleMap
          levels={Object.fromEntries(summary.ranked.map((item) => [item.muscle, item.level]))}
          label="muscle impact map"
        />
      </section>
    );
  }

  const top = summary.ranked.slice(0, 5);
  return (
    <div className={styles.chips} aria-label="Top muscles by impact">
      {top.map(({ muscle, label, level }) => (
        <span className={styles.chip} data-level={level} key={muscle}>
          {label}
        </span>
      ))}
    </div>
  );
}
