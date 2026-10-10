"use client";

import { useVetoedSwitch } from "./useVetoedSwitch";
export const RPE_STOPS = [6, 7, 8, 9, 10] as const;

/** The stop whose palette entry (`data-rpe`) a rating uses: rounded, clamped to 6–10. */
export function rpeStop(rating: number): number {
  return Math.min(10, Math.max(6, Math.round(rating)));
}

/** Static scale reference, parked at the bottom of the session page. */
export function RpeLegend() {
  return (
    <div className="rpelegend">
      <div className="lgd-h">RPE scale · reps left in the tank</div>
      <dl>
        {RPE_STOPS.map((n) => (
          <div key={n}>
            <dt data-rpe={n}>{n}</dt>
            <dd>{RIR_LABEL[n]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Five switch-backed choices that stay within the fixed-height exercise row. */
export function RpeSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="rpe">
      <span className="k">RPE</span>
      <div className="rpe-stops" role="group" aria-label="RPE">
        {RPE_STOPS.map((stop) => (
          <RpeStop key={stop} value={stop} selected={value === stop} onPick={onChange} />
        ))}
      </div>
    </div>
  );
}

function RpeStop({
  value,
  selected,
  onPick,
}: {
  value: number;
  selected: boolean;
  onPick: (n: number) => void;
}) {
  const { inputRef, onChange } = useVetoedSwitch(() => onPick(value));
  return (
    <label className={`rpe-stop${selected ? " selected" : ""}`} data-rpe={value}>
      {value}
      <input
        ref={inputRef}
        type="checkbox"
        className="rpe-switch"
        checked={selected}
        aria-label={`RPE ${value}`}
        onChange={onChange}
      />
    </label>
  );
}

/**
 * RPE (Rate of Perceived Exertion) 6–10, the reps-in-reserve scale:
 * RIR = 10 − RPE. These labels are the actual meaning, one per stop.
 *
 * They live in the page-footer legend rather than under the stops: on an
 * exercise row the caption is read once and then becomes noise on every
 * subsequent set, while costing a line of height in the one place height is
 * scarcest.
 */
export const RIR_LABEL: Record<number, string> = {
  6: "≈4 reps in reserve · easy",
  7: "≈3 reps in reserve",
  8: "≈2 reps in reserve",
  9: "≈1 rep in reserve · near limit",
  10: "0 in reserve · all-out",
};
