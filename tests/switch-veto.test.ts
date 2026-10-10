import { describe, expect, it } from "vitest";
import { shouldAcceptSwitchChange } from "../lib/switch-veto";

describe("shouldAcceptSwitchChange", () => {
  it("accepts a click without a recorded pointer or touch", () => {
    expect(shouldAcceptSwitchChange(null)).toBe(true);
  });

  it("accepts a gesture that moved exactly 10 pixels", () => {
    expect(shouldAcceptSwitchChange({ maxDistance: 10, cancelled: false })).toBe(true);
  });

  it("vetoes a gesture that moved more than 10 pixels", () => {
    expect(shouldAcceptSwitchChange({ maxDistance: 10.01, cancelled: false })).toBe(false);
  });

  it("vetoes a cancelled gesture even without movement", () => {
    expect(shouldAcceptSwitchChange({ maxDistance: 0, cancelled: true })).toBe(false);
  });
});
