"use client";

import { hapticRef } from "@/lib/haptics";
import { Sheet } from "./Sheet";

/**
 * Compact confirmation bottom-sheet on the shared sheet. Guards destructive
 * actions (skip an exercise) and non-destructive prompts (apply a change to
 * later sets) — `tone` colours the primary button accordingly.
 */
export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Keep it",
  tone = "danger",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "accent";
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} className="confirm">
      {body && <p>{body}</p>}
      <div className="confirmrow">
        <button className="cancel" ref={hapticRef} data-haptic="selection" onClick={onClose}>
          {cancelLabel}
        </button>
        <button
          className={tone === "accent" ? "apply" : "danger"}
          ref={hapticRef}
          data-haptic={tone === "accent" ? "medium" : "heavy"}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
