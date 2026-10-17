import { describe, expect, it } from "vitest";
import { budgetToFinishIn, type Debt, planDebts } from "./debt";

const debts: Debt[] = [
  // A card at 4,25% a month and a cheaper loan at 2,5%.
  {
    id: "card",
    balance: 20_000_00,
    monthlyRate: 0.0425,
    minimumPayment: 4_000_00,
  },
  {
    id: "loan",
    balance: 60_000_00,
    monthlyRate: 0.025,
    minimumPayment: 3_000_00,
  },
  { id: "friend", balance: 5_000_00, monthlyRate: 0, minimumPayment: 500_00 },
];

describe("planDebts", () => {
  it("pays the smallest debt first or the most expensive one first", () => {
    const smallest = planDebts(debts, 10_000_00, "smallest");
    const highest = planDebts(debts, 10_000_00, "highestRate");
    // The friend's debt is gone first with the snowball…
    expect(smallest.payoffMonth.friend).toBeLessThan(
      smallest.payoffMonth.card!,
    );
    // …and the card first when the rate decides.
    expect(highest.payoffMonth.card).toBeLessThan(highest.payoffMonth.friend!);
    expect(highest.totalInterest).toBeLessThan(smallest.totalInterest);
    expect(smallest.months).not.toBeNull();
    // Every month the whole budget is used until the last one.
    const first = smallest.schedule[0]!.payments;
    expect(Object.values(first).reduce((a, b) => a + b, 0)).toBe(10_000_00);
  });

  it("finishes sooner with an extra payment", () => {
    const base = planDebts(debts, 10_000_00, "highestRate");
    const extra = planDebts(debts, 12_000_00, "highestRate");
    expect(extra.months!).toBeLessThan(base.months!);
    expect(extra.totalInterest).toBeLessThan(base.totalInterest);
  });

  it("reports a plan that never ends when interest eats the payments", () => {
    const plan = planDebts(
      [
        {
          id: "x",
          balance: 100_000_00,
          monthlyRate: 0.05,
          minimumPayment: 1_000_00,
        },
      ],
      1_000_00,
      "smallest",
    );
    expect(plan.months).toBeNull();
  });

  it("handles a debt-free list", () => {
    expect(planDebts([], 1_000_00, "smallest")).toMatchObject({
      months: 0,
      totalInterest: 0,
    });
  });
});

describe("budgetToFinishIn", () => {
  it("finds the monthly budget that clears everything by a date", () => {
    const budget = budgetToFinishIn(debts, 12, "highestRate")!;
    expect(planDebts(debts, budget, "highestRate").months).toBeLessThanOrEqual(
      12,
    );
    expect(
      planDebts(debts, budget - 100_00, "highestRate").months,
    ).toBeGreaterThan(12);
    expect(budgetToFinishIn([], 12, "smallest")).toBe(0);
  });
});
