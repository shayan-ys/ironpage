"use client";

import { useEffect, useRef, useState } from "react";
import type { Unit } from "@/lib/types";

/**
 * Big tap target -> iOS numeric keypad (inputMode="decimal").
 * The whole value is preselected on focus, so the first keystroke replaces it.
 */
export function WeightInput({
  value,
  unit,
  onCommit,
  onDone,
}: {
  value: number;
  unit: Unit;
  onCommit: (n: number) => void;
  onDone?: (n: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);

  return (
    <div className="fld">
      <label>{unit}</label>
      <input
        className="wt"
        type="text"
        inputMode="decimal"
        enterKeyHint="done"
        value={text}
        onFocus={(e) => {
          focused.current = true;
          e.currentTarget.select();
        }}
        onBlur={() => {
          focused.current = false;
          const n = parseFloat(text);
          if (!Number.isNaN(n)) onDone?.(n);
          setText(String(value));
        }}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, "");
          setText(raw);
          const n = parseFloat(raw);
          if (!Number.isNaN(n)) onCommit(n);
        }}
      />
    </div>
  );
}
