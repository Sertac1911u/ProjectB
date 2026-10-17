import { describe, expect, it } from "vitest";
import { addMonths, budgetsInMonth, budgetStatus, monthOf } from "./budget";

describe("budgetStatus", () => {
  it("warns from 80% and reports overspending", () => {
    expect(budgetStatus(0, 100_00)).toBe("ok");
    expect(budgetStatus(79_99, 100_00)).toBe("ok");
    expect(budgetStatus(80_00, 100_00)).toBe("warning");
    expect(budgetStatus(100_00, 100_00)).toBe("warning");
    expect(budgetStatus(100_01, 100_00)).toBe("over");
  });
});

describe("months", () => {
  it("finds the month of a day and moves across years", () => {
    expect(monthOf("2026-10-17")).toBe("2026-10-01");
    expect(addMonths("2026-10-01", 3)).toBe("2027-01-01");
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
    expect(addMonths("2026-12-01", -12)).toBe("2025-12-01");
  });
});

describe("budgetsInMonth", () => {
  const v = (categoryId: string, month: string, amount: number | null) => ({
    categoryId,
    month,
    amount,
    currency: "TRY",
  });
  const versions = [
    v("food", "2026-08-01", 5_000_00),
    v("food", "2026-10-01", 6_000_00),
    v("fun", "2026-09-01", 1_000_00),
    v("fun", "2026-11-01", null),
  ];
  const limits = (month: string) =>
    Object.fromEntries(
      [...budgetsInMonth(versions, month)].map(([id, b]) => [id, b.amount]),
    );

  it("keeps a limit until a later version changes or removes it", () => {
    expect(limits("2026-07-01")).toEqual({});
    expect(limits("2026-09-01")).toEqual({ food: 5_000_00, fun: 1_000_00 });
    expect(limits("2026-10-01")).toEqual({ food: 6_000_00, fun: 1_000_00 });
    expect(limits("2027-03-01")).toEqual({ food: 6_000_00 });
  });
});
