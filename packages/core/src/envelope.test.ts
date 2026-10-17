import { describe, expect, it } from "vitest";
import { envelopeCycle, reservedBy, wholeMonths } from "./envelope";

describe("wholeMonths", () => {
  it("counts complete months", () => {
    expect(wholeMonths("2026-10-17", "2027-04-17")).toBe(6);
    expect(wholeMonths("2026-10-17", "2027-04-16")).toBe(5);
    expect(wholeMonths("2026-10-17", "2026-10-30")).toBe(1);
  });
});

describe("envelopeCycle", () => {
  const insurance = {
    amount: 12_000_00,
    startOn: "2026-10-17",
    dueOn: "2027-04-17",
    intervalMonths: 12,
  };

  it("spreads a payment over the months before it", () => {
    expect(envelopeCycle(insurance, "2026-10-17")).toMatchObject({
      due: "2027-04-17",
      reserved: 0,
      monthly: 2_000_00,
      passed: false,
    });
    // Half way through the 182 days, half is set aside.
    expect(envelopeCycle(insurance, "2027-01-16").reserved).toBe(6_000_00);
  });

  it("starts saving for the next payment once one is due", () => {
    expect(envelopeCycle(insurance, "2027-04-18")).toMatchObject({
      start: "2027-04-17",
      due: "2028-04-17",
      monthly: 1_000_00,
      passed: false,
    });
    const once = { ...insurance, intervalMonths: null };
    expect(envelopeCycle(once, "2027-04-18")).toMatchObject({
      passed: true,
      reserved: 0,
    });
  });

  it("keeps out what is set aside by the end of the pay period", () => {
    // By 28 October, 11 of 182 days have passed.
    expect(reservedBy(insurance, "2026-10-17", "2026-10-28")).toBe(72_527);
    const soon = {
      amount: 3_000_00,
      startOn: "2026-09-01",
      dueOn: "2026-10-25",
      intervalMonths: null,
    };
    expect(reservedBy(soon, "2026-10-17", "2026-10-28")).toBe(3_000_00);
  });
});
