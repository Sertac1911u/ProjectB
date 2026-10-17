import { describe, expect, it } from "vitest";
import {
  accountSchema,
  budgetSchema,
  contributionSchema,
  goalSchema,
  parseAmount,
  parseTags,
  recurringSchema,
  transactionSchema,
} from "./forms";
import { fieldErrors } from "./validation";

const account = "7b0a1c3e-6c8e-4c3a-9b8e-2f1d0c4b5a69";
const other = "0f9e8d7c-6b5a-4f3e-8d2c-1b0a9f8e7d6c";

describe("parseTags", () => {
  it("trims, collapses spaces and drops duplicates ignoring case", () => {
    expect(parseTags(" tatil, Yaz  tatili ,TATİL,, tatil ")).toEqual([
      "tatil",
      "Yaz tatili",
      "TATİL",
    ]);
  });
});

describe("transactionSchema", () => {
  const base = {
    accountId: account,
    amount: "12,50",
    occurredOn: "2026-10-17",
  };

  it("accepts an expense and normalizes optional fields", () => {
    expect(
      transactionSchema.parse({ ...base, kind: "expense", categoryId: "" }),
    ).toEqual({
      ...base,
      kind: "expense",
      categoryId: null,
      toAccountId: null,
      toAmount: "",
      note: null,
      tags: [],
      installments: 1,
    });
  });

  it("requires a different target account for transfers", () => {
    const missing = transactionSchema.safeParse({ ...base, kind: "transfer" });
    expect(fieldErrors(missing.error!)).toEqual({
      toAccountId: "accountRequired",
    });
    const same = transactionSchema.safeParse({
      ...base,
      kind: "transfer",
      toAccountId: account,
    });
    expect(fieldErrors(same.error!)).toEqual({ toAccountId: "sameAccount" });
    expect(
      transactionSchema.safeParse({
        ...base,
        kind: "transfer",
        toAccountId: other,
      }).success,
    ).toBe(true);
  });

  it("reports field errors as translation keys", () => {
    const result = transactionSchema.safeParse({
      kind: "gift",
      accountId: "",
      amount: " ",
      occurredOn: "17.10.2026",
      tags: "a".repeat(31),
    });
    expect(fieldErrors(result.error!)).toEqual({
      kind: "invalidKind",
      accountId: "accountRequired",
      amount: "amountRequired",
      occurredOn: "invalidDate",
      tags: "tagTooLong",
    });
  });
});

describe("parseAmount", () => {
  it("parses positive amounts in the user's notation", () => {
    expect(parseAmount("1.250,75", "TRY", "tr")).toEqual({ amount: 125075 });
  });

  it("rejects zero and negative amounts unless allowed", () => {
    expect(parseAmount("0", "TRY", "tr")).toEqual({
      error: "amountNotPositive",
    });
    expect(parseAmount("-5", "TRY", "tr")).toEqual({
      error: "amountNotPositive",
    });
    expect(parseAmount("-5", "TRY", "tr", { allowNegative: true })).toEqual({
      amount: -500,
    });
    expect(parseAmount("0", "TRY", "tr", { allowZero: true })).toEqual({
      amount: 0,
    });
    expect(parseAmount("abc", "TRY", "tr")).toEqual({ error: "invalidAmount" });
  });
});

describe("accountSchema", () => {
  const base = { name: "Kart", currency: "TRY" };

  it("ignores card settings for other account types", () => {
    expect(
      accountSchema.parse({ ...base, type: "bank", statementDay: "99" }).card,
    ).toBeNull();
  });

  it("requires valid statement and due days for credit cards", () => {
    const result = accountSchema.safeParse({
      ...base,
      type: "credit_card",
      dueDay: "32",
    });
    expect(fieldErrors(result.error!)).toEqual({
      statementDay: "invalidDay",
      dueDay: "invalidDay",
    });
    expect(
      accountSchema.parse({
        ...base,
        type: "credit_card",
        statementDay: "15",
        dueDay: "25",
      }).card,
    ).toEqual({ statementDay: 15, dueDay: 25, minPaymentRate: 20 });
  });
});

describe("transactionSchema installments", () => {
  const base = { accountId: account, amount: "100", occurredOn: "2026-10-17" };

  it("defaults to a single payment and allows installments only for expenses", () => {
    expect(
      transactionSchema.parse({ ...base, kind: "expense" }).installments,
    ).toBe(1);
    expect(
      transactionSchema.parse({ ...base, kind: "expense", installments: "6" })
        .installments,
    ).toBe(6);
    const income = transactionSchema.safeParse({
      ...base,
      kind: "income",
      installments: "3",
    });
    expect(fieldErrors(income.error!)).toEqual({
      installments: "invalidInstallments",
    });
    const tooMany = transactionSchema.safeParse({
      ...base,
      kind: "expense",
      installments: "48",
    });
    expect(fieldErrors(tooMany.error!)).toEqual({
      installments: "invalidInstallments",
    });
  });
});

describe("recurringSchema", () => {
  const base = {
    kind: "expense",
    accountId: account,
    amount: "15.000",
    startOn: "2026-11-01",
    frequency: "monthly",
  };

  it("defaults to every month without an end", () => {
    expect(recurringSchema.parse(base)).toMatchObject({
      frequency: "monthly",
      interval: 1,
      endOn: null,
      maxOccurrences: null,
    });
  });

  it("validates how the schedule ends", () => {
    expect(
      recurringSchema.parse({
        ...base,
        ends: "afterCount",
        maxOccurrences: "12",
      }).maxOccurrences,
    ).toBe(12);
    expect(
      recurringSchema.parse({ ...base, ends: "onDate", endOn: "2027-10-31" })
        .endOn,
    ).toBe("2027-10-31");
    const before = recurringSchema.safeParse({
      ...base,
      ends: "onDate",
      endOn: "2026-10-01",
    });
    expect(fieldErrors(before.error!)).toEqual({ endOn: "invalidEndDate" });
    const none = recurringSchema.safeParse({
      ...base,
      ends: "afterCount",
      maxOccurrences: "0",
    });
    expect(fieldErrors(none.error!)).toEqual({
      maxOccurrences: "invalidOccurrences",
    });
    const weird = recurringSchema.safeParse({
      ...base,
      frequency: "daily",
      interval: "13",
    });
    expect(fieldErrors(weird.error!)).toEqual({
      frequency: "invalidFrequency",
      interval: "invalidInterval",
    });
  });

  it("applies the transfer rules", () => {
    const same = recurringSchema.safeParse({
      ...base,
      kind: "transfer",
      toAccountId: account,
    });
    expect(fieldErrors(same.error!)).toEqual({ toAccountId: "sameAccount" });
  });
});

describe("budgetSchema", () => {
  it("needs a category and the first day of a month", () => {
    expect(
      budgetSchema.parse({
        categoryId: account,
        amount: "5.000",
        month: "2026-10-01",
      }),
    ).toEqual({ categoryId: account, amount: "5.000", month: "2026-10-01" });
    const result = budgetSchema.safeParse({
      categoryId: "",
      amount: "",
      month: "2026-10-17",
    });
    expect(fieldErrors(result.error!)).toEqual({
      categoryId: "categoryRequired",
      amount: "amountRequired",
      month: "invalidDate",
    });
  });
});

describe("goalSchema", () => {
  it("makes the target date and account optional", () => {
    expect(
      goalSchema.parse({
        name: " Tatil ",
        targetAmount: "30.000",
        currency: "TRY",
        targetDate: "",
        accountId: "",
      }),
    ).toEqual({
      name: "Tatil",
      targetAmount: "30.000",
      currency: "TRY",
      targetDate: null,
      accountId: null,
    });
    const result = goalSchema.safeParse({
      name: "",
      targetAmount: "1",
      currency: "XYZ",
      targetDate: "31.12.2026",
    });
    expect(fieldErrors(result.error!)).toEqual({
      name: "nameRequired",
      currency: "invalidCurrency",
      targetDate: "invalidDate",
    });
  });
});

describe("contributionSchema", () => {
  it("accepts deposits and withdrawals", () => {
    expect(
      contributionSchema.parse({
        direction: "withdraw",
        amount: "500",
        occurredOn: "2026-10-17",
      }),
    ).toEqual({
      direction: "withdraw",
      amount: "500",
      occurredOn: "2026-10-17",
      note: null,
    });
    expect(
      contributionSchema.safeParse({
        direction: "steal",
        amount: "500",
        occurredOn: "2026-10-17",
      }).success,
    ).toBe(false);
  });
});
