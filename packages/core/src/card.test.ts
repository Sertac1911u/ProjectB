import { describe, expect, it } from "vitest";
import {
  addStatements,
  buildStatement,
  type CardTransaction,
  debtOn,
  dueDate,
  installmentAmounts,
  lastStatementOn,
  statementFor,
  upcomingInstallments,
} from "./card";

const CARD = "card";
const BANK = "bank";
let n = 0;
const tx = (
  t: Partial<CardTransaction> &
    Pick<CardTransaction, "kind" | "amount" | "occurredOn">,
) =>
  ({
    id: `t${++n}`,
    accountId: CARD,
    toAccountId: null,
    toAmount: null,
    installmentCount: 1,
    ...t,
  }) satisfies CardTransaction;
const payment = (amount: number, occurredOn: string) =>
  tx({
    kind: "transfer",
    accountId: BANK,
    toAccountId: CARD,
    amount,
    toAmount: amount,
    occurredOn,
  });

describe("statement dates", () => {
  it("assigns a day to the statement closing on or after it", () => {
    expect(statementFor("2026-10-15", 15)).toBe("2026-10-15");
    expect(statementFor("2026-10-16", 15)).toBe("2026-11-15");
    expect(statementFor("2026-12-20", 15)).toBe("2027-01-15");
  });

  it("clamps the statement day to short months", () => {
    expect(statementFor("2026-02-10", 31)).toBe("2026-02-28");
    expect(statementFor("2026-03-01", 31)).toBe("2026-03-31");
    expect(addStatements("2026-01-31", 1, 31)).toBe("2026-02-28");
    expect(addStatements("2026-02-28", 1, 31)).toBe("2026-03-31");
    expect(addStatements("2026-01-15", -1, 15)).toBe("2025-12-15");
  });

  it("finds the latest statement on or before a day", () => {
    expect(lastStatementOn("2026-10-15", 15)).toBe("2026-10-15");
    expect(lastStatementOn("2026-10-14", 15)).toBe("2026-09-15");
    expect(lastStatementOn("2026-10-20", 15)).toBe("2026-10-15");
  });

  it("puts the due date on the first due day after the statement", () => {
    expect(dueDate("2026-10-15", 25)).toBe("2026-10-25");
    expect(dueDate("2026-10-25", 5)).toBe("2026-11-05");
    expect(dueDate("2026-10-15", 15)).toBe("2026-11-15");
    expect(dueDate("2026-01-20", 31)).toBe("2026-01-31");
  });
});

describe("installmentAmounts", () => {
  it("splits evenly and gives leftover kuruş to the first installments", () => {
    expect(installmentAmounts(1_200_000, 6)).toEqual(Array(6).fill(200_000));
    expect(installmentAmounts(1000, 3)).toEqual([334, 333, 333]);
    expect(installmentAmounts(1000, 3).reduce((a, b) => a + b)).toBe(1000);
  });
});

describe("buildStatement", () => {
  const card = {
    openingBalance: 0,
    statementDay: 15,
    dueDay: 25,
    minPaymentRate: 20,
  };

  it("bills one installment per statement while the full amount counts as debt", () => {
    const laptop = tx({
      kind: "expense",
      amount: 1_200_000,
      occurredOn: "2026-09-20",
      installmentCount: 6,
    });
    const coffee = tx({
      kind: "expense",
      amount: 5_000,
      occurredOn: "2026-10-01",
    });
    const txs = [laptop, coffee];

    // The laptop was bought after the 15 Sep statement: first installment on 15 Oct.
    const october = buildStatement(card, txs, CARD, "2026-10-15", "2026-10-17");
    expect(october.periodStart).toBe("2026-09-16");
    expect(october.dueDate).toBe("2026-10-25");
    expect(october.lines).toEqual([
      {
        transactionId: laptop.id,
        occurredOn: "2026-09-20",
        amount: 200_000,
        installment: { number: 1, count: 6 },
      },
      { transactionId: coffee.id, occurredOn: "2026-10-01", amount: 5_000 },
    ]);
    expect(october.amount).toBe(205_000);
    expect(october.minimumPayment).toBe(41_000);
    expect(debtOn(card, txs, CARD, "2026-10-15")).toBe(1_205_000);

    const upcoming = upcomingInstallments(card, txs, CARD, "2026-10-15", 6);
    expect(upcoming.map((u) => u.amount)).toEqual([
      200_000, 200_000, 200_000, 200_000, 200_000, 0,
    ]);
    expect(upcoming[0]?.statementDate).toBe("2026-11-15");
  });

  it("tracks payments after the statement and carries unpaid amounts over", () => {
    const txs = [
      tx({ kind: "expense", amount: 100_000, occurredOn: "2026-10-05" }),
      payment(60_000, "2026-10-20"),
      tx({ kind: "expense", amount: 10_000, occurredOn: "2026-11-01" }),
    ];
    const october = buildStatement(card, txs, CARD, "2026-10-15", "2026-10-22");
    expect(october).toMatchObject({
      amount: 100_000,
      paidSince: 60_000,
      remaining: 40_000,
    });

    // November: 40.000 left over plus the new 10.000; the payment is a line.
    const november = buildStatement(
      card,
      txs,
      CARD,
      "2026-11-15",
      "2026-11-16",
    );
    expect(november.amount).toBe(50_000);
    expect(november.lines.map((l) => l.amount)).toEqual([-60_000, 10_000]);
  });

  it("treats refunds as credits and never asks for a minimum on a credit balance", () => {
    const txs = [
      tx({ kind: "expense", amount: 20_000, occurredOn: "2026-10-01" }),
      tx({ kind: "income", amount: 30_000, occurredOn: "2026-10-02" }),
    ];
    const statement = buildStatement(
      card,
      txs,
      CARD,
      "2026-10-15",
      "2026-10-15",
    );
    expect(statement).toMatchObject({
      amount: -10_000,
      minimumPayment: 0,
      remaining: 0,
    });
  });

  it("includes the opening debt and cash taken from the card", () => {
    const txs = [
      tx({
        kind: "transfer",
        accountId: CARD,
        toAccountId: BANK,
        amount: 50_000,
        toAmount: 50_000,
        occurredOn: "2026-10-03",
      }),
    ];
    const statement = buildStatement(
      { ...card, openingBalance: -25_000 },
      txs,
      CARD,
      "2026-10-15",
      "2026-10-15",
    );
    expect(statement.amount).toBe(75_000);
  });

  it("ignores transactions of other accounts", () => {
    const txs = [
      tx({
        kind: "expense",
        accountId: BANK,
        amount: 99_999,
        occurredOn: "2026-10-01",
      }),
    ];
    expect(
      buildStatement(card, txs, CARD, "2026-10-15", "2026-10-15").amount,
    ).toBe(0);
  });
});
