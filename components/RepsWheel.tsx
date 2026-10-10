"use client";

/**
 * Native <select> — iOS renders this as the drum/wheel picker. Options run
 * 1…`max`; a stored value outside that range is kept as an extra option so
 * the row still shows what was logged. `seconds` relabels it for a timed
 * exercise, whose reps field holds the hold length.
 */
export function RepsWheel({
  value,
  max = 40,
  seconds = false,
  onCommit,
}: {
  value: number;
  max?: number;
  seconds?: boolean;
  onCommit: (n: number) => void;
}) {
  const options = Array.from({ length: max }, (_, i) => i + 1);
  if (value > max) options.push(value);
  else if (value < 1) options.unshift(value);
  return (
    <div className="fld">
      <label>{seconds ? "sec" : "reps"}</label>
      <select
        className="repsel"
        aria-label={seconds ? "seconds" : "reps"}
        value={value}
        onChange={(e) => onCommit(Number(e.target.value))}
      >
        {options.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </div>
  );
}
