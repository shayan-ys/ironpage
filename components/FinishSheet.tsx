"use client";

import { useState } from "react";
import { hapticRef } from "@/lib/haptics";
import type { SessionFeel } from "@/lib/types";
import { Sheet } from "./Sheet";

const FEELS: { key: SessionFeel; emoji: string; label: string }[] = [
  { key: "spent", emoji: "😮‍💨", label: "spent" },
  { key: "strong", emoji: "💪", label: "strong" },
  { key: "fire", emoji: "🔥", label: "on fire" },
];

/**
 * The close-out sheet. When sets are still pending it doubles as the "stop
 * here" confirmation: it says exactly what is being left behind and offers
 * pausing instead, so ending early is a choice rather than the only door out.
 */
export function FinishSheet({
  open,
  remaining,
  onFinish,
  onPause,
  onClose,
}: {
  open: boolean;
  remaining: number;
  onFinish: (feel: SessionFeel | null) => void;
  onPause: () => void;
  onClose: () => void;
}) {
  const early = remaining > 0;
  return (
    <Sheet open={open} onClose={onClose} title={early ? "End it here?" : "Session done 🎉"}>
      <FinishBody early={early} remaining={remaining} onFinish={onFinish} onPause={onPause} />
    </Sheet>
  );
}

/** Mounted only while the sheet is open, so the chosen feel resets each time. */
function FinishBody({
  early,
  remaining,
  onFinish,
  onPause,
}: {
  early: boolean;
  remaining: number;
  onFinish: (feel: SessionFeel | null) => void;
  onPause: () => void;
}) {
  const [feel, setFeel] = useState<SessionFeel | null>(null);
  return (
    <>
      <p>
        {early
          ? `${remaining} working set${remaining > 1 ? "s" : ""} left. They stay unticked and the session closes as what you actually did.`
          : "How did the whole thing feel?"}
      </p>
      <div className="faces">
        {FEELS.map((f) => (
          <button
            key={f.key}
            className={`face${feel === f.key ? " sel" : ""}`}
            ref={hapticRef}
            data-haptic="selection"
            onClick={() => setFeel(f.key)}
          >
            {f.emoji}
            <span>{f.label}</span>
          </button>
        ))}
      </div>
      <button className="save" ref={hapticRef} data-haptic="success" onClick={() => onFinish(feel)}>
        {early ? "End & save" : "Save & finish"}
      </button>
      {early && (
        <button className="sheetalt" ref={hapticRef} data-haptic="medium" onClick={onPause}>
          not done for the day — pause instead
        </button>
      )}
    </>
  );
}
