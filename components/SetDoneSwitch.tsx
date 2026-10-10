"use client";

import { useState } from "react";
import { useVetoedSwitch } from "./useVetoedSwitch";
import { unlockRestAlerts } from "./RestExperience";

export function SetDoneSwitch({
  checked,
  label,
  className = "",
  disabled = false,
  onToggle,
}: {
  checked: boolean;
  label: string;
  className?: string;
  /** A disabled native switch never fires `change`: no iOS buzz, no flip, no ring. */
  disabled?: boolean;
  onToggle: () => void;
}) {
  const [flash, setFlash] = useState(0);
  const { inputRef, onChange } = useVetoedSwitch(() => {
    onToggle();
    setFlash((count) => count + 1);
  });

  return (
    <label
      key={flash}
      className={`check${className ? ` ${className}` : ""}${flash > 0 ? " check-flash" : ""}`}
    >
      <input
        ref={inputRef}
        type="checkbox"
        className="chk-switch"
        checked={checked}
        disabled={disabled}
        onChange={() => {
          // Inside the tap gesture: unlock the rest chime before the 60 ms veto.
          if (!checked) unlockRestAlerts();
          onChange();
        }}
        aria-label={checked ? `mark ${label} not done` : `mark ${label} done`}
      />
      <span className="chk-mark" aria-hidden="true">
        {checked ? "✓" : "○"}
      </span>
    </label>
  );
}
