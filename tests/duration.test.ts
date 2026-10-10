import { describe, expect, it } from "vitest";
import { formatSessionDuration, stripDayEstimate } from "../lib/duration";

describe("formatSessionDuration", () => {
  const startedAt = "2026-10-09T12:00:00.000Z";

  it.each([
    { minutes: 59.4, expected: "59 min" },
    { minutes: 59.6, expected: "1 h" },
    { minutes: 72, expected: "1 h 12 min" },
    { minutes: 20 / 60, expected: "1 min" },
    { minutes: 60, expected: "1 h" },
  ])("formats $minutes minutes as $expected", ({ minutes, expected }) => {
    const finishedAt = new Date(Date.parse(startedAt) + minutes * 60_000).toISOString();
    expect(formatSessionDuration(startedAt, finishedAt)).toBe(expected);
  });

  it("hides missing, invalid, or backwards timestamps", () => {
    expect(formatSessionDuration(startedAt, null)).toBeNull();
    expect(formatSessionDuration(startedAt, "not a date")).toBeNull();
    expect(formatSessionDuration(startedAt, "2026-10-09T11:59:59.999Z")).toBeNull();
  });
});

describe("stripDayEstimate", () => {
  it.each([
    ["A · Lower / Glute (~65 min)", "A · Lower / Glute"],
    ["B · Short Day (~35 min)", "B · Short Day"],
    ["A · Upper / Push", "A · Upper / Push"],
  ])("strips only a trailing duration estimate from %s", (dayName, expected) => {
    expect(stripDayEstimate(dayName)).toBe(expected);
  });
});
