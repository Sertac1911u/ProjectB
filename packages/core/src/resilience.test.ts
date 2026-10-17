import { describe, expect, it } from "vitest";
import {
  monthlyEquivalent,
  resilience,
  resilienceLevel,
  runway,
} from "./resilience";

describe("monthlyEquivalent", () => {
  it("spreads weekly, monthly and yearly payments over a month", () => {
    expect(monthlyEquivalent(1_200_00, "yearly", 1)).toBe(100_00);
    expect(monthlyEquivalent(300_00, "monthly", 3)).toBe(100_00);
    expect(monthlyEquivalent(100_00, "weekly", 1)).toBe(43_333);
  });
});

describe("runway and levels", () => {
  it("counts months and names the level", () => {
    expect(runway(90_000_00, 30_000_00)).toBe(3);
    expect(runway(-5_00, 30_000_00)).toBe(0);
    expect(runway(1_00, 0)).toBeNull();
    expect([0.5, 1, 3, 6, null].map(resilienceLevel)).toEqual([
      "weak",
      "building",
      "good",
      "strong",
      "strong",
    ]);
  });
});

describe("resilience", () => {
  it("works out the runway and the what-if scenarios", () => {
    const result = resilience({
      reserve: 96_000_00,
      upcoming30: 16_640_00,
      averageIncome: 50_000_00,
      averageExpense: 32_000_00,
      essentialMonthly: 18_000_00,
      shock: 15_000_00,
    });
    expect(result).toEqual({
      reserve: 96_000_00,
      afterUpcoming: 79_360_00,
      months: 3,
      essentialMonths: 96 / 18,
      level: "good",
      scenarios: {
        // 40.000 income left against 32.000 spending: still saving 8.000.
        incomeDrop: { monthlyNet: 8_000_00, months: null },
        shock: { amount: 15_000_00, months: 81 / 32 },
      },
    });
  });

  it("falls back to regular payments without a spending history", () => {
    const result = resilience({
      reserve: 20_000_00,
      upcoming30: 0,
      averageIncome: 0,
      averageExpense: 0,
      essentialMonthly: 10_000_00,
      shock: 15_000_00,
    });
    expect(result.months).toBe(2);
    expect(result.scenarios.incomeDrop).toEqual({
      monthlyNet: -10_000_00,
      months: 2,
    });
  });
});
