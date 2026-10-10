import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import schema from "../public/program.schema.json";
import { validateProgram } from "../lib/program-validate";
import { STARTER_PROGRAMS } from "../lib/starter-programs";
import { MUSCLE_IDS, type Program, type ProgramExercise } from "../lib/types";

const checkSchema = new Ajv({ allErrors: true }).compile(schema);

function exercise(over: Record<string, unknown> = {}): ProgramExercise {
  return {
    id: "calf",
    name: "Calf",
    targetSets: 3,
    targetReps: 10,
    targetRPE: 9,
    seedWeight: 140,
    seedIsGuess: false,
    notes: [{ label: "Cue", text: "deep stretch" }],
    muscles: { calves: 1 },
    ...over,
  } as ProgramExercise;
}

const program = (...exercises: ProgramExercise[]): Program => ({
  unit: "lb",
  days: [{ id: "a", name: "A", exercises }],
});

describe("starter programs", () => {
  for (const starter of STARTER_PROGRAMS) {
    for (const unit of ["lb", "kg"] as const) {
      it(`${starter.id} in ${unit} passes validateProgram and the schema`, () => {
        const built = starter.build(unit);
        expect(built.unit).toBe(unit);
        expect(validateProgram(built)).toEqual({ ok: true, program: built });
        expect(checkSchema(built), JSON.stringify(checkSchema.errors)).toBe(true);
      });
    }
  }
});

describe("validateProgram", () => {
  it("accepts a full exercise, a warm-up and an exercise id repeated on another day", () => {
    const full = exercise({
      targets: [{ from: "2026-10-06T00:00:00-04:00", weightLb: 150, reps: 8, sets: 4, rampSets: [{ weightLb: 75, reps: 5 }] }],
      rampSets: [{ weightLb: 70, reps: 5, restSec: 45 }],
      then: "add 5 lb",
      restSec: 90,
      supersetId: "s1",
      timed: false,
    });
    const p: Program = {
      unit: "kg",
      days: [
        { id: "a", name: "A", exercises: [full], warmup: { total: "~5 min", drills: [{ name: "Walk", dose: "3 min" }] } },
        { id: "b", name: "B", exercises: [exercise()] },
      ],
    } as Program;
    expect(validateProgram(p).ok).toBe(true);
    expect(checkSchema(p), JSON.stringify(checkSchema.errors)).toBe(true);
  });

  const invalid: [string, unknown, string][] = [
    ["a non-object", "nope", "program: must be an object"],
    ["an unknown unit", { unit: "st", days: program(exercise()).days }, 'unit: must be "lb" or "kg"'],
    ["no days", { unit: "lb", days: [] }, "days: must be a non-empty array"],
    ["missing muscles", program(exercise({ muscles: undefined })), "days[0].exercises[0].muscles: required"],
    ["an unknown muscle", program(exercise({ muscles: { neck: 1 } })), 'days[0].exercises[0].muscles: unknown muscle "neck"'],
    ["only zero scores", program(exercise({ muscles: { calves: 0 } })), "days[0].exercises[0].muscles: needs at least one"],
    ["a score above 1", program(exercise({ muscles: { quads: 1.5 } })), "days[0].exercises[0].muscles.quads: must be a number from 0 to 1"],
    ["no note rows", program(exercise({ notes: [] })), "days[0].exercises[0].notes: must be a non-empty array"],
    ["the old string note", program(exercise({ note: "x" })), 'days[0].exercises[0].note: replaced by "notes"'],
    ["an empty then", program(exercise({ then: " " })), "days[0].exercises[0].then: must be a non-empty string"],
    ["a non-boolean timed flag", program(exercise({ timed: "true" })), "days[0].exercises[0].timed: must be true or false"],
    ["an RPE below 6", program(exercise({ targetRPE: 5 })), "days[0].exercises[0].targetRPE: must be a number from 6 to 10"],
    ["a misspelt field", program(exercise({ sets: 3 })), 'days[0].exercises[0]: unknown field "sets"'],
    ["a bare target date", program(exercise({ targets: [{ from: "2026-10-06" }] })), "days[0].exercises[0].targets[0].from: must be a date-time"],
    ["a ramp set without reps", program(exercise({ rampSets: [{ weightLb: 20 }] })), "days[0].exercises[0].rampSets[0].reps: required"],
  ];

  for (const [label, input, error] of invalid) {
    it(`rejects ${label}, and so does the schema`, () => {
      const result = validateProgram(input);
      expect(result.ok).toBe(false);
      expect(result.ok ? [] : result.errors.join("\n")).toContain(error);
      expect(checkSchema(input)).toBe(false);
    });
  }

  it("rejects duplicate day ids and an exercise id repeated within a day", () => {
    const p = { unit: "lb", days: [...program(exercise(), exercise()).days, ...program(exercise()).days] };
    const result = validateProgram(p);
    expect(result.ok ? [] : result.errors).toEqual([
      'days[0].exercises[1].id: "calf" is already used in this day',
      'days[1].id: "a" is already used by another day',
    ]);
  });
});

describe("program.schema.json", () => {
  it("lists the same muscle ids as the app", () => {
    expect(schema.definitions.exercise.properties.muscles.propertyNames.enum).toEqual([...MUSCLE_IDS]);
  });
});
