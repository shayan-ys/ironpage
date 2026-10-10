"use client";

import { hapticRef } from "@/lib/haptics";
import { HOLD_MAX_SECONDS } from "@/lib/hold";
import type { LoggedSet, Unit } from "@/lib/types";
import { WeightInput } from "./WeightInput";
import { RepsWheel } from "./RepsWheel";
import { SetDoneSwitch } from "./SetDoneSwitch";
export function SetRow({
  label,
  warm,
  set,
  unit,
  active,
  blocked = false,
  hold,
  onToggleDone,
  onWeight,
  onWeightDone,
  onReps,
  onUnskip,
  onRemove,
}: {
  /** Display tag for the row: "1", "2"… for working sets, "W1", "W2"… for ramps. */
  label: string;
  warm: boolean;
  set: LoggedSet;
  unit: Unit;
  /** The row you are working: highlighted, and the auto-scroll target. */
  active: boolean;
  /** An earlier working set is still pending: the done switch ignores taps. */
  blocked?: boolean;
  /** Timed exercises only: the ▶ that starts this row's hold countdown. */
  hold?: { disabled: boolean; onStart: () => void };
  onToggleDone: () => void;
  onWeight: (n: number) => void;
  onWeightDone: (n: number) => void;
  onReps: (n: number) => void;
  onUnskip: () => void;
  /** Ramp rows only — working sets have no delete affordance. */
  onRemove?: () => void;
}) {
  // Legacy: sessions logged before swipe-to-skip was dropped may still hold
  // per-set skips. Keep the restore affordance so that data stays editable.
  if (set.skipped) {
    return (
      <div className="setwrap">
        <button className="set skipped" ref={hapticRef} data-haptic="light" onClick={onUnskip}>
          <div className="n">{label}</div>
          <div className="skipped-lbl">skipped · tap to restore</div>
        </button>
      </div>
    );
  }

  return (
    <div className={`setwrap${active ? " active" : ""}`}>
      <div className={`set${warm ? " warm" : ""}${hold ? " timed" : ""}${set.done ? " done" : ""}${active ? " active" : ""}`}>
        <div className="setmain">
          <div className="n">{label}</div>
          <WeightInput value={set.weightLb} unit={unit} onCommit={onWeight} onDone={onWeightDone} />
          {hold ? (
            // The ▶ sits in the seconds column, beside the hold length it runs.
            <div className="holdcell">
              <RepsWheel value={set.reps} max={HOLD_MAX_SECONDS} seconds onCommit={onReps} />
              <button
                type="button"
                className="holdstart"
                disabled={hold.disabled}
                ref={hapticRef}
                data-haptic="medium"
                onClick={hold.onStart}
                aria-label={`start ${set.reps} s hold`}
              >
                <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                  <path d="M8 5v14l11-7Z" />
                </svg>
              </button>
            </div>
          ) : (
            <RepsWheel value={set.reps} onCommit={onReps} />
          )}
          <SetDoneSwitch checked={set.done} label="set" disabled={blocked} onToggle={onToggleDone} />
          {/* Ramp rows are added by hand in-session, so they need a way back
              out. It sits at the end of the main row, past the done switch, so
              it is far from the weight/reps fields it would be painful to
              fat-finger. */}
          {onRemove && (
            <button
              className="rmwarm"
              ref={hapticRef}
              data-haptic="light"
              onClick={onRemove}
              aria-label={`remove warm-up set ${label}`}
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
