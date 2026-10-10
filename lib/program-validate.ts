import { MUSCLE_IDS, type Program } from "./types";

/**
 * The one check a program passes before it is stored (`PUT /api/program`) or
 * offered for upload (the settings page). Pure, so the browser and the server
 * run the same rules. Each error names its path, e.g.
 * `days[1].exercises[2].muscles: required`, so a pasted or AI-written program
 * can be fixed without reading code. `public/program.schema.json` states the
 * same shape for tools; keep the two in step.
 *
 * Unknown fields are refused rather than ignored: a misspelt field (`sets` for
 * `targetSets`) would otherwise drop silently, and the old free-text `note`
 * must not lose its text by being ignored. Exercise ids may repeat across days
 * (the same lift on two days shares its history) but not within a day; day ids
 * must be unique because sessions record them.
 */
export type ProgramValidation = { ok: true; program: Program } | { ok: false; errors: string[] };

const PROGRAM_KEYS = ["unit", "days"];
const DAY_KEYS = ["id", "name", "exercises", "warmup"];
const WARMUP_KEYS = ["total", "note", "drills"];
const DRILL_KEYS = ["name", "dose", "why"];
const EXERCISE_KEYS = [
  "id", "name", "targetSets", "targetReps", "targetRPE", "seedWeight", "seedIsGuess", "targets",
  "rampSets", "notes", "then", "restSec", "supersetId", "timed", "muscles",
];
const STEP_KEYS = ["from", "weightLb", "reps", "sets", "rampSets"];
const RAMP_KEYS = ["weightLb", "reps", "restSec"];
const NOTE_KEYS = ["label", "text"];

/** Fields from older program formats, refused with a pointer to their replacement. */
const RETIRED: Record<string, string> = { note: 'replaced by "notes" rows ({ label, text })' };

/** RFC 3339 date-time with an explicit offset; a bare date parses as UTC midnight. */
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/i;

type Obj = Record<string, unknown>;

export function validateProgram(input: unknown): ProgramValidation {
  const errors: string[] = [];
  // The program itself is path "", so its fields read `unit` and `days[0].id`.
  const fail = (path: string, message: string) => errors.push(`${path || "program"}: ${message}`);
  const at = (path: string, key: string) => (path ? `${path}.${key}` : key);

  const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
  const text = (v: unknown) => typeof v === "string" && v.trim() !== "";
  const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  const count = (v: unknown) => num(v) && Number.isInteger(v) && v >= 1;

  /** Object check plus unknown-key report; false when `v` is not an object. */
  function shape(v: unknown, path: string, keys: string[]): v is Obj {
    if (!isObj(v)) {
      fail(path, "must be an object");
      return false;
    }
    for (const key of Object.keys(v)) {
      if (keys.includes(key)) continue;
      if (key in RETIRED) fail(at(path, key), RETIRED[key]);
      else fail(path, `unknown field "${key}"`);
    }
    return true;
  }

  function field(o: Obj, path: string, key: string, ok: (v: unknown) => boolean, need: string, required = true) {
    const v = o[key];
    if (v === undefined) {
      if (required) fail(at(path, key), "required");
    } else if (!ok(v)) {
      fail(at(path, key), `must be ${need}`);
    }
  }

  function list(o: Obj, path: string, key: string, required: boolean): unknown[] | null {
    const v = o[key];
    if (v === undefined) {
      if (required) fail(at(path, key), "required");
      return null;
    }
    if (!Array.isArray(v) || v.length === 0) {
      fail(at(path, key), "must be a non-empty array");
      return null;
    }
    return v;
  }

  function rampSets(o: Obj, path: string) {
    list(o, path, "rampSets", false)?.forEach((r, i) => {
      const p = `${path}.rampSets[${i}]`;
      if (!shape(r, p, RAMP_KEYS)) return;
      field(r, p, "weightLb", (v) => num(v) && v >= 0, "a number of 0 or more");
      field(r, p, "reps", count, "a whole number of 1 or more");
      field(r, p, "restSec", (v) => num(v) && v >= 0, "a number of seconds, 0 or more", false);
    });
  }

  function exercise(e: unknown, path: string) {
    if (!shape(e, path, EXERCISE_KEYS)) return;
    field(e, path, "id", text, "a non-empty string");
    field(e, path, "name", text, "a non-empty string");
    field(e, path, "targetSets", count, "a whole number of 1 or more");
    field(e, path, "targetReps", count, "a whole number of 1 or more");
    field(e, path, "targetRPE", (v) => num(v) && v >= 6 && v <= 10, "a number from 6 to 10");
    field(e, path, "seedWeight", (v) => num(v) && v >= 0, "a number of 0 or more");
    field(e, path, "seedIsGuess", (v) => typeof v === "boolean", "true or false");
    field(e, path, "then", text, "a non-empty string", false);
    field(e, path, "restSec", (v) => num(v) && v >= 0, "a number of seconds, 0 or more", false);
    field(e, path, "supersetId", text, "a non-empty string", false);
    field(e, path, "timed", (v) => typeof v === "boolean", "true or false", false);

    list(e, path, "notes", true)?.forEach((row, i) => {
      const p = `${path}.notes[${i}]`;
      if (!shape(row, p, NOTE_KEYS)) return;
      field(row, p, "label", text, "a non-empty string");
      field(row, p, "text", text, "a non-empty string");
    });

    const muscles = e.muscles;
    if (muscles === undefined) {
      fail(`${path}.muscles`, "required");
    } else if (!isObj(muscles)) {
      fail(`${path}.muscles`, "must be an object of muscle scores");
    } else {
      let positive = false;
      for (const [id, score] of Object.entries(muscles)) {
        if (!(MUSCLE_IDS as readonly string[]).includes(id)) {
          fail(`${path}.muscles`, `unknown muscle "${id}" (use one of: ${MUSCLE_IDS.join(", ")})`);
        } else if (!num(score) || score < 0 || score > 1) {
          fail(`${path}.muscles.${id}`, "must be a number from 0 to 1");
        } else if (score > 0) {
          positive = true;
        }
      }
      if (!positive) fail(`${path}.muscles`, "needs at least one muscle scored above 0");
    }

    rampSets(e, path);
    list(e, path, "targets", false)?.forEach((step, i) => {
      const p = `${path}.targets[${i}]`;
      if (!shape(step, p, STEP_KEYS)) return;
      field(
        step, p, "from",
        (v) => typeof v === "string" && DATE_TIME.test(v) && !Number.isNaN(Date.parse(v)),
        'a date-time with an offset, e.g. "2026-10-06T00:00:00-04:00"',
      );
      field(step, p, "weightLb", (v) => num(v) && v >= 0, "a number of 0 or more", false);
      field(step, p, "reps", count, "a whole number of 1 or more", false);
      field(step, p, "sets", count, "a whole number of 1 or more", false);
      rampSets(step, p);
    });
  }

  function day(d: unknown, path: string) {
    if (!shape(d, path, DAY_KEYS)) return;
    field(d, path, "id", text, "a non-empty string");
    field(d, path, "name", text, "a non-empty string");

    if (d.warmup !== undefined && shape(d.warmup, `${path}.warmup`, WARMUP_KEYS)) {
      const w = d.warmup;
      const p = `${path}.warmup`;
      field(w, p, "total", text, "a non-empty string", false);
      field(w, p, "note", text, "a non-empty string", false);
      list(w, p, "drills", true)?.forEach((drill, i) => {
        const dp = `${p}.drills[${i}]`;
        if (!shape(drill, dp, DRILL_KEYS)) return;
        field(drill, dp, "name", text, "a non-empty string");
        field(drill, dp, "dose", text, "a non-empty string");
        field(drill, dp, "why", text, "a non-empty string", false);
      });
    }

    const exercises = list(d, path, "exercises", true);
    const seen = new Set<string>();
    exercises?.forEach((e, i) => {
      const p = `${path}.exercises[${i}]`;
      exercise(e, p);
      const id = isObj(e) ? e.id : undefined;
      if (typeof id === "string") {
        if (seen.has(id)) fail(`${p}.id`, `"${id}" is already used in this day`);
        seen.add(id);
      }
    });
  }

  if (shape(input, "", PROGRAM_KEYS)) {
    field(input, "", "unit", (v) => v === "lb" || v === "kg", '"lb" or "kg"');
    const days = list(input, "", "days", true);
    const seen = new Set<string>();
    days?.forEach((d, i) => {
      const p = `days[${i}]`;
      day(d, p);
      const id = isObj(d) ? d.id : undefined;
      if (typeof id === "string") {
        if (seen.has(id)) fail(`${p}.id`, `"${id}" is already used by another day`);
        seen.add(id);
      }
    });
  }

  return errors.length === 0 ? { ok: true, program: input as Program } : { ok: false, errors };
}
