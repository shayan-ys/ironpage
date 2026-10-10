import { describe, expect, it } from "vitest";
import { buildRampSet } from "../lib/rampsets";

describe("buildRampSet rounding", () => {
  it("rounds lb ramp loads to 2.5", () => {
    // 135 * 0.5 = 67.5, 135 * 0.65 = 87.75 -> 87.5, 135 * 0.8 = 108 -> 107.5
    expect(buildRampSet(135, 8, 0, "lb").weightLb).toBe(67.5);
    expect(buildRampSet(135, 8, 1, "lb").weightLb).toBe(87.5);
    expect(buildRampSet(135, 8, 2, "lb").weightLb).toBe(107.5);
  });

  it("rounds kg ramp loads to 1.25", () => {
    // 60 * 0.5 = 30, 60 * 0.65 = 39 -> 38.75, 60 * 0.8 = 48 -> 47.5, 60 * 0.875 = 52.5
    expect(buildRampSet(60, 8, 0, "kg").weightLb).toBe(30);
    expect(buildRampSet(60, 8, 1, "kg").weightLb).toBe(38.75);
    expect(buildRampSet(60, 8, 2, "kg").weightLb).toBe(47.5);
    expect(buildRampSet(60, 8, 3, "kg").weightLb).toBe(52.5);
  });

  it("uses the unit step for the same working weight", () => {
    expect(buildRampSet(100, 8, 1, "kg").weightLb).toBe(65);
    expect(buildRampSet(82.5, 8, 0, "kg").weightLb).toBe(41.25);
    expect(buildRampSet(82.5, 8, 0, "lb").weightLb).toBe(42.5);
  });

  it("repeats the top rung past the ladder and caps reps at the working reps", () => {
    expect(buildRampSet(60, 3, 9, "kg")).toMatchObject({ weightLb: 52.5, reps: 2, warmup: true });
    expect(buildRampSet(60, 3, 0, "kg").reps).toBe(3);
  });
});
