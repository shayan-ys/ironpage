"use client";

import { useEffect, useState } from "react";
import { hapticRef } from "@/lib/haptics";
import { findSetRow, glideToSet, stickyBottom } from "./setFocus";

type Direction = "up" | "down" | null;

/**
 * A green arrow that appears once the current set has scrolled fully out of
 * view: under the progress bar pointing up when the set is above you, at the
 * bottom pointing down when it is below. Tapping it glides the set back onto
 * the focus line. It reads the row's position on every scroll, resize and
 * layout change, so it also tracks the current set moving on after a tick.
 */
export function CurrentSetPill({ targetKey }: { targetKey: string | null }) {
  const [direction, setDirection] = useState<Direction>(null);
  const [top, setTop] = useState(0);

  useEffect(() => {
    if (targetKey === null) {
      setDirection(null);
      return;
    }
    let frame = 0;
    const measure = () => {
      frame = 0;
      const row = findSetRow(targetKey);
      if (!row) {
        setDirection(null);
        return;
      }
      const box = row.getBoundingClientRect();
      const covered = stickyBottom();
      setTop(covered);
      setDirection(box.bottom <= covered ? "up" : box.top >= window.innerHeight ? "down" : null);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    const layout = new ResizeObserver(schedule);
    layout.observe(document.body);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      layout.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [targetKey]);

  if (direction === null || targetKey === null) return null;
  return (
    <button
      type="button"
      className={`setpill setpill--${direction}`}
      style={direction === "up" ? { top: top + 10 } : undefined}
      aria-label={direction === "up" ? "Scroll up to the current set" : "Scroll down to the current set"}
      ref={hapticRef}
      data-haptic="selection"
      onClick={() => {
        const row = findSetRow(targetKey);
        if (row) glideToSet(row);
      }}
    >
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <path d={direction === "up" ? "M12 19V5M5 12l7-7 7 7" : "M12 5v14M5 12l7 7 7-7"} />
      </svg>
    </button>
  );
}
