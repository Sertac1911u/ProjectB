import { describe, expect, it } from "vitest";
import { goalProgress, monthsLeft } from "./goal";

describe("monthsLeft", () => {
  it("counts the months left to save, including the current one", () => {
    expect(monthsLeft("2026-10-17", "2026-12-31")).toBe(3);
    expect(monthsLeft("2026-10-17", "2026-11-10")).toBe(1);
    expect(monthsLeft("2026-10-17", "2026-10-17")).toBe(1);
    expect(monthsLeft("2026-10-17", "2027-10-17")).toBe(13);
    expect(monthsLeft("2026-10-17", "2026-10-16")).toBe(0);
  });
});

describe("goalProgress", () => {
  it("works out what is left and the monthly amount for the target date", () => {
    expect(
      goalProgress(30_000_00, 6_000_00, "2026-12-31", "2026-10-17"),
    ).toEqual({
      saved: 6_000_00,
      remaining: 24_000_00,
      percent: 20,
      reached: false,
      monthsLeft: 3,
      monthlyNeeded: 8_000_00,
      overdue: false,
    });
  });

  it("handles goals without a date, reached goals and overdue ones", () => {
    expect(goalProgress(100_00, 20_00, null, "2026-10-17")).toMatchObject({
      monthsLeft: null,
      monthlyNeeded: null,
      overdue: false,
    });
    expect(
      goalProgress(100_00, 150_00, "2026-01-01", "2026-10-17"),
    ).toMatchObject({
      reached: true,
      percent: 100,
      remaining: 0,
      overdue: false,
    });
    expect(
      goalProgress(100_00, -5_00, "2026-01-01", "2026-10-17"),
    ).toMatchObject({
      saved: 0,
      percent: 0,
      overdue: true,
      monthlyNeeded: null,
    });
  });
});
