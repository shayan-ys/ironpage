import { MUSCLE_IDS } from "./types";

/**
 * The prompt "Copy AI prompt" puts on the clipboard: it asks ChatGPT, Claude
 * or similar to turn the user's own program into this app's JSON. `origin` is
 * the app's address, so the model can read the schema it must follow.
 */
export function programPrompt(origin: string): string {
  return `Convert my workout program into JSON for the Ironpage app.

Follow this JSON Schema exactly: ${origin}/program.schema.json
If you cannot open the link, use the rules below.

Shape:
{ "unit": "lb" or "kg", "days": [ { "id", "name", "exercises": [ ... ] } ] }

Rules:
- "unit" is the unit of every weight in the program. Do not convert weights.
- Each day has a unique, stable "id" in lowercase-with-dashes (for example "upper-a").
- Each exercise needs:
  - "id": stable, lowercase-with-dashes, from the movement (for example "bench-press"). Use the same id when the same lift appears on two days; do not repeat an id within one day.
  - "name", "targetSets", "targetReps" (seconds when "timed" is true), "targetRPE" (6 to 10).
  - "seedWeight": the first-session weight in the program unit (0 for bodyweight), and "seedIsGuess": true when that weight is an estimate.
  - "notes": at least one { "label", "text" } row, for example { "label": "Cue", "text": "elbows tucked" }.
  - "muscles": scores from 0 to 1 for the muscles it trains: 1 primary mover, 0.75 major, 0.5 secondary, 0.25 minor. At least one score above 0. Use only these ids: ${MUSCLE_IDS.join(", ")}.
- Optional exercise fields: "restSec" (rest after each working set, in seconds), "supersetId" (the same value on adjacent exercises that alternate), "timed": true for holds, "rampSets": [{ "weightLb", "reps", "restSec" }] for planned warm-up sets (weights in the program unit despite the name), "then" (one sentence on how to progress).
- Optional day field: "warmup": { "total": "~6 min", "note": "...", "drills": [{ "name", "dose", "why" }] }.
- Do not add any other fields.

Reply with the JSON only, no explanation and no code fence.

My program:
`;
}
