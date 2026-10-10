"use client";

import { hapticRef } from "@/lib/haptics";
import { RpeSlider, rpeStop } from "./RpeSlider";

/**
 * How hard the lift was — one rating for the whole exercise.
 *
 * RPE used to be rated per set. It is not any more, for two reasons. The
 * programme prescribes a single target per exercise (the three-tier map:
 * compound 7–8, isolation 9, high-rep 9–10), so three per-set numbers were
 * three answers to a question that was only asked once. And a fixed working
 * load already makes effort climb across sets by itself — reps to failure fall
 * to roughly 70 %, 55 % and 50 % of the first set (Nuzzo 2024) — so a rising
 * per-set score recorded a mechanical certainty, not a decision. Six taps a
 * session bought nothing.
 *
 * Same chip↔slider swap the set rows used, at the same fixed height, so opening
 * it never reflows the exercise below it.
 */
export function ExerciseRpe({
  value,
  target,
  open,
  onOpen,
  onChange,
}: {
  /** The logged rating, or null while the exercise is unrated. */
  value: number | null;
  /** The programme's target for this exercise — what the chip advertises first. */
  target: number;
  open: boolean;
  onOpen: () => void;
  onChange: (n: number) => void;
}) {
  const rated = value !== null;
  return (
    <div className="exrpe">
      {open ? (
        <RpeSlider value={value ?? target} onChange={onChange} />
      ) : (
        <button
          className="rpechip"
          // Targets need not be whole; round and clamp so every chip has a palette entry.
          data-rpe={rpeStop(value ?? target)}
          ref={hapticRef}
          data-haptic="selection"
          onClick={onOpen}
          aria-label={`RPE ${value ?? target}, ${rated ? "logged" : "target"} — tap to adjust`}
        >
          <span className="k">RPE</span>
          <span className="v">{value ?? target}</span>
          <span className="t">{rated ? "logged" : "target"}</span>
        </button>
      )}
    </div>
  );
}
