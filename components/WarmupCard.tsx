"use client";

import { useState } from "react";
import type { ProgramDay } from "@/lib/types";
import { hapticRef } from "@/lib/haptics";
import { SetDoneSwitch } from "./SetDoneSwitch";

/**
 * The program day's general warm-up (`ProgramDay.warmup`), shown at the top of
 * a session, with a single checkmark for the whole card — per-drill ticking
 * would be four taps of bookkeeping for no extra signal. Hidden when the day
 * has no warm-up.
 *
 * Ticking it collapses and dims the card, which both clears the screen for the
 * first lift and timestamps the prep/work boundary (`warmupDoneAt` on the
 * session). Expansion is explicit state rather than <details>, so completing it
 * can close the card without fighting a native toggle on the same click.
 */
export function WarmupCard({
  warmup,
  doneAt,
  onToggle,
}: {
  warmup: ProgramDay["warmup"];
  doneAt: string | null;
  onToggle: () => void;
}) {
  const done = doneAt !== null;
  const [open, setOpen] = useState(!done);

  if (!warmup || warmup.drills.length === 0) return null;

  const stamp = doneAt
    ? new Date(doneAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <section className={`warmup${done ? " done" : ""}${open ? " open" : ""}`}>
      <div className="wu-head">
        <button
          type="button"
          className="wu-toggle"
          aria-expanded={open}
          ref={hapticRef}
          data-haptic="selection"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="wu-title">Warm-up</span>
          <span className="wu-sub">{done && stamp ? `done ${stamp}` : warmup.total}</span>
          <span className="wu-chevron" aria-hidden>
            ▾
          </span>
        </button>
        <SetDoneSwitch
          checked={done}
          label="warm-up"
          className="wu-check"
          onToggle={() => {
            // Finishing the warm-up folds it away; un-ticking reopens it,
            // because the only reason to un-tick is to look at it again.
            setOpen(done);
            onToggle();
          }}
        />
      </div>

      {open && (
        <>
          <ol className="wu-list">
            {warmup.drills.map((d) => (
              <li key={d.name}>
                <div className="wu-top">
                  <span className="wu-name">{d.name}</span>
                  <span className="wu-dose">{d.dose}</span>
                </div>
                {d.why && <div className="wu-why">{d.why}</div>}
              </li>
            ))}
          </ol>
          {warmup.note && <p className="wu-note">{warmup.note}</p>}
        </>
      )}
    </section>
  );
}
