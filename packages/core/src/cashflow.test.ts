import { describe, expect, it } from "vitest";
import type { CardSettings, CardTransaction } from "./card";
import {
  cardPayments,
  forecast,
  occurrencesUntil,
  spendImpact,
} from "./cashflow";

const today = "2026-10-17";

describe("occurrencesUntil", () => {
  it("lists dates up to the end of the range and the schedule", () => {
    const monthly = {
      startOn: "2026-08-31",
      frequency: "monthly" as const,
      interval: 1,
      endOn: null,
      maxOccurrences: 5,
    };
    expect(occurrencesUntil(monthly, 2, "2027-03-01")).toEqual([
      "2026-10-31",
      "2026-11-30",
      "2026-12-31",
    ]);
  });
});

describe("forecast", () => {
  const event = (on: string, amount: number, source = "") => ({
    on,
    amount,
    source,
  });

  it("finds the safe amount and daily limit until payday", () => {
    // Rent on the 20th, salary on the 29th: 12 days from 17 to 28 October.
    const result = forecast({
      today,
      balance: 20_000_00,
      events: [
        event("2026-10-20", -15_000_00, "rent"),
        event("2026-10-25", -1_640_00, "card"),
        event("2026-10-29", 50_000_00, "salary"),
        event("2026-11-01", -229_99, "netflix"),
      ],
      payday: "2026-10-29",
      monthEnd: "2026-10-31",
    });
    expect(result.daysLeft).toBe(12);
    expect(result.lowest).toEqual({ on: "2026-10-25", balance: 3_360_00 });
    expect(result.safeToSpend).toBe(3_360_00);
    expect(result.dailyLimit).toBe(280_00);
    expect(result.windowEndBalance).toBe(3_360_00);
    expect(result.entries.map((e) => [e.source, e.beforePayday])).toEqual([
      ["rent", true],
      ["card", true],
      ["salary", false],
      ["netflix", false],
    ]);
    expect(result.shortfalls).toEqual([]);

    expect(spendImpact(result, 2_000_00)).toEqual({
      safeToSpend: 1_360_00,
      dailyLimit: 113_33,
      windowEndBalance: 1_360_00,
      fits: true,
    });
    expect(spendImpact(result, 4_000_00).fits).toBe(false);
  });

  it("flags the payment that leaves too little money before payday", () => {
    // Rent on the 5th, loan on the 8th, salary on the 10th.
    const result = forecast({
      today: "2026-11-01",
      balance: 18_000_00,
      events: [
        event("2026-11-05", -15_000_00, "rent"),
        event("2026-11-08", -4_000_00, "loan"),
        event("2026-11-10", 50_000_00, "salary"),
      ],
      payday: "2026-11-10",
      monthEnd: "2026-11-30",
    });
    expect(result.safeToSpend).toBe(-1_000_00);
    expect(result.dailyLimit).toBe(0);
    expect(result.shortfalls.map((e) => [e.source, e.balance])).toEqual([
      ["loan", -1_000_00],
    ]);
  });

  it("uses the end of the month without a payday and puts payments first", () => {
    const result = forecast({
      today,
      balance: 1_000_00,
      events: [
        event("2026-10-20", 500_00, "refund"),
        event("2026-10-20", -1_200_00, "bill"),
        event("2026-10-10", -999_00, "past"),
      ],
      payday: null,
      monthEnd: "2026-10-31",
    });
    expect(result.daysLeft).toBe(15);
    expect(result.entries.map((e) => e.source)).toEqual(["bill", "refund"]);
    expect(result.lowest.balance).toBe(-200_00);
    expect(result.windowEndBalance).toBe(300_00);
  });
});

describe("cardPayments", () => {
  const card: CardSettings = {
    openingBalance: 0,
    statementDay: 15,
    dueDay: 25,
    minPaymentRate: 20,
  };
  const tx = (
    id: string,
    occurredOn: string,
    amount: number,
    extra: Partial<CardTransaction> = {},
  ): CardTransaction => ({
    id,
    kind: "expense",
    accountId: "card",
    toAccountId: null,
    amount,
    toAmount: null,
    occurredOn,
    installmentCount: 1,
    ...extra,
  });

  it("pays the closed statement, then the open period and later installments", () => {
    const transactions = [
      tx("a", "2026-10-05", 1_000_00),
      tx("b", "2026-10-16", 300_00),
      tx("c", "2026-10-01", 6_000_00, { installmentCount: 3 }),
    ];
    const payments = cardPayments(
      card,
      transactions,
      "card",
      today,
      "2026-12-31",
      [{ on: "2026-11-01", amount: 229_99 }],
    );
    expect(payments).toEqual([
      {
        on: "2026-10-25",
        statementDate: "2026-10-15",
        dueDate: "2026-10-25",
        amount: 3_000_00,
        overdue: false,
      },
      {
        on: "2026-11-25",
        statementDate: "2026-11-15",
        dueDate: "2026-11-25",
        amount: 300_00 + 2_000_00 + 229_99,
        overdue: false,
      },
      {
        on: "2026-12-25",
        statementDate: "2026-12-15",
        dueDate: "2026-12-25",
        amount: 2_000_00,
        overdue: false,
      },
    ]);
  });

  it("treats an unpaid statement past its due date as due today", () => {
    const payments = cardPayments(
      card,
      [tx("a", "2026-09-10", 500_00)],
      "card",
      "2026-10-10",
      "2026-10-31",
    );
    expect(payments[0]).toMatchObject({
      on: "2026-10-10",
      dueDate: "2026-09-25",
      amount: 500_00,
      overdue: true,
    });
  });
});
