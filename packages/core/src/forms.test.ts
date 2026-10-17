import { describe, expect, it } from "vitest";
import {
  accountSchema,
  parseAmount,
  parseTags,
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
