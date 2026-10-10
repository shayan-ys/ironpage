"use client";

import type { LastExerciseNote } from "@/lib/notes";
import type { ProgramWeeks } from "@/lib/program-notes";
import type { MuscleScores, ProgramNoteRow, Unit } from "@/lib/types";
import { MuscleFocus } from "./MuscleFocus";
import { Sheet } from "./Sheet";

/**
 * An exercise's notes, opened from the card's notes pill. Top to bottom, each
 * only when present: the worked muscles (a cropped body map, MuscleFocus),
 * Last time (the lifter's exercise note from the previous
 * session that included it), then one labelled list: the program note's rows,
 * Weeks (the program's week steps, this one highlighted) and Then (how to
 * progress after them). The body scrolls; a swipe down first scrolls it back
 * to the top before it starts closing the sheet.
 */
export function NotesSheet({
  open,
  name,
  muscles,
  unit,
  lastNote,
  notes,
  weeks,
  then,
  onClose,
}: {
  open: boolean;
  name: string;
  muscles?: MuscleScores;
  unit: Unit;
  lastNote?: LastExerciseNote;
  notes?: ProgramNoteRow[];
  weeks?: ProgramWeeks;
  then?: string;
  onClose: () => void;
}) {
  const hasPlan = !!notes?.length || !!weeks || !!then;
  const hasMuscles = !!muscles && Object.values(muscles).some((s) => (s ?? 0) > 0);
  return (
    <Sheet open={open} onClose={onClose} title={name} className="notes">
      <div className="notesbody">
        {muscles && hasMuscles && (
          <section className="notepart">
            <MuscleFocus muscles={muscles} />
          </section>
        )}
        {lastNote && (
          <section className="notepart last">
            <h3>
              Last time
              <span className="when">
                {new Date(lastNote.startedAt).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </h3>
            <p>{lastNote.text}</p>
          </section>
        )}
        {hasPlan && (
          <section className="notepart">
            <dl className="noterows">
              {notes?.map((row, i) => (
                <div key={i}>
                  <dt>{row.label}</dt>
                  <dd><RowText text={row.text} /></dd>
                </div>
              ))}
              {weeks && (
                <div>
                  <dt>Weeks · {unit}</dt>
                  <dd className="weeks">
                    {weeks.chips.map((c, i) => (
                      <span key={i} className={c.state}>
                        <small>W{i + 1}</small>
                        {c.weightLb ?? "–"}
                        {weeks.showReps && <i>×{c.reps}</i>}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
              {then && (
                <div>
                  <dt>Then</dt>
                  <dd>{then}</dd>
                </div>
              )}
            </dl>
          </section>
        )}
      </div>
    </Sheet>
  );
}

/** A row's text: one line reads as a phrase, two or more lines as bullets. */
function RowText({ text }: { text: string }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return <>{lines[0] ?? ""}</>;
  return (
    <ul className="notebullets">
      {lines.map((l, i) => (
        <li key={i}>{l}</li>
      ))}
    </ul>
  );
}
