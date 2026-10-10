"use client";

import { hapticRef } from "../haptics";
import { installDemoApi } from "./api";
import { resetDemo } from "./store";

// At module load, so the shim is in place before any page component renders
// or fetches: the root layout imports this module, and its chunk evaluates
// before hydration starts.
if (typeof window !== "undefined") installDemoApi();

/**
 * The strip above every demo page: says where the data lives and puts the
 * demo back to its seed. Reset reloads the overview rather than navigating
 * within the app, so no open screen keeps a copy of the old data in memory.
 */
export function DemoBar() {
  function reset() {
    resetDemo();
    window.location.assign(`${process.env.GYM_BASE_PATH ?? ""}/`);
  }
  return (
    <div
      role="note"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "calc(env(safe-area-inset-top) + 6px) 12px 6px",
        background: "var(--panel)",
        borderBottom: "1px solid var(--line)",
        color: "var(--dim)",
        font: "500 12px var(--sans)",
      }}
    >
      <span>Demo · your data stays in this browser ·</span>
      <button
        type="button"
        onClick={reset}
        ref={hapticRef}
        data-haptic="heavy"
        style={{
          background: "none",
          border: "none",
          padding: "4px 2px",
          color: "var(--accent)",
          font: "600 12px var(--sans)",
          cursor: "pointer",
        }}
      >
        Reset
      </button>
    </div>
  );
}
