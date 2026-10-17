import { describe, expect, it } from "vitest";
import { goalDelayDays, goalForecast, goalProgress, monthsLeft } from "./goal";

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

describe("goalDelayDays", () => {
  it("turns money spent into days of saving", () => {
    // Saving ₺20.000 a month, ₺8.000 takes about 13 days to save again.
    expect(goalDelayDays(8_000_00, 20_000_00)).toBe(13);
    expect(goalDelayDays(1_00, 20_000_00)).toBe(1);
    expect(goalDelayDays(8_000_00, 0)).toBeNull();
    expect(goalDelayDays(8_000_00, null)).toBeNull();
  });
});

describe("goalForecast", () => {
  it("dates the goal from the monthly saving", () => {
    // ₺60.000 left at ₺20.000 a month: about three months.
    expect(
      goalForecast(60_000_00, 20_000_00, "2026-10-17", "2026-12-31"),
    ).toEqual({
      reachOn: "2027-01-17",
      onTime: false,
    });
    expect(
      goalForecast(60_000_00, 30_000_00, "2026-10-17", "2026-12-31"),
    ).toEqual({
      reachOn: "2026-12-17",
      onTime: true,
    });
    expect(goalForecast(60_000_00, null, "2026-10-17", null)).toEqual({
      reachOn: null,
      onTime: null,
    });
    expect(goalForecast(0, null, "2026-10-17", null).reachOn).toBe(
      "2026-10-17",
    );
  });
});
