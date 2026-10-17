import { z } from "zod";
import { CURRENCIES, type CurrencyCode } from "./currency";
import { MAX_INSTALLMENTS } from "./card";
import { FREQUENCIES, MAX_INTERVAL, MAX_OCCURRENCES } from "./recurring";
import {
  ACCOUNT_TYPES,
  CATEGORY_KINDS,
  GOLD_UNITS,
  QUANTITY_DECIMALS,
  RATE_DECIMALS,
  TRANSACTION_KINDS,
} from "./finance";
import { type MinorUnits, parseMoney, parseScaled } from "./money";
import { error, type ValidationError } from "./validation";

const currencyCodes = Object.keys(CURRENCIES) as [
  CurrencyCode,
  ...CurrencyCode[],
];

const name = (max: number) =>
  z
    .string()
    .trim()
    .min(1, error("nameRequired"))
    .max(max, error("nameTooLong"));

/** An optional id from a form: empty strings mean "none". */
const optionalId = (message: ValidationError) =>
  z
    .string()
    .optional()
    .transform((v) => v || null)
    .pipe(z.uuid(error(message)).nullable());

const day = z.coerce
  .number(error("invalidDay"))
  .int(error("invalidDay"))
  .min(1, error("invalidDay"))
  .max(31, error("invalidDay"));

export const accountSchema = z
  .object({
    name: name(60),
    type: z.enum(ACCOUNT_TYPES, error("invalidAccountType")),
    currency: z.enum(currencyCodes, error("invalidCurrency")),
    /** Typed by the user in their locale's notation; parsed with parseAmount. */
    openingBalance: z.string().optional().default(""),
    // Credit cards only.
    creditLimit: z.string().optional().default(""),
    statementDay: z.string().optional().default(""),
    dueDay: z.string().optional().default(""),
    minPaymentRate: z.string().optional().default("20"),
    /** A checkbox: present when ticked. Never set for cards, loans or gold. */
    spendable: z
      .string()
      .optional()
      .transform((v) => v === "on" || v === "true"),
    /** Monthly interest in percent, for cards and loans. */
    interestRate: z.string().optional().default(""),
    // Loans only: the monthly installment and what is still owed.
    loanPayment: z.string().optional().default(""),
    loanRemaining: z.string().optional().default(""),
    // Gold only.
    goldUnit: z.string().optional().default("gram"),
    goldQuantity: z.string().optional().default(""),
    unitPrice: z.string().optional().default(""),
    /** Locale of the typed numbers; set by the server action. */
    locale: z.string().optional().default("tr"),
  })
  .transform((data, ctx) => {
    const {
      statementDay,
      dueDay,
      minPaymentRate,
      interestRate,
      loanPayment,
      loanRemaining,
      goldUnit,
      goldQuantity,
      unitPrice,
      locale,
      ...rest
    } = data;
    const issue = (path: string, message: ValidationError) =>
      ctx.addIssue({ code: "custom", path: [path], ...error(message) });

    let rateBp: number | null = null;
    if (
      (data.type === "credit_card" || data.type === "loan") &&
      interestRate.trim()
    ) {
      rateBp = parseScaled(interestRate, RATE_DECIMALS, locale);
      if (rateBp === null || rateBp < 0 || rateBp > 10_000) {
        issue("interestRate", "invalidRate");
      }
    }
    const loan =
      data.type === "loan"
        ? {
            payment: loanPayment,
            remaining: loanRemaining,
          }
        : null;
    if (loan && !loan.remaining.trim())
      issue("loanRemaining", "amountRequired");
    if (loan && !loan.payment.trim()) issue("loanPayment", "amountRequired");

    let gold = null as null | {
      unit: (typeof GOLD_UNITS)[number];
      quantityMilli: number;
      unitPrice: string;
    };
    if (data.type === "gold") {
      const unit = GOLD_UNITS.find((u) => u === goldUnit);
      const quantity = parseScaled(goldQuantity, QUANTITY_DECIMALS, locale);
      if (!unit) issue("goldUnit", "invalidAccountType");
      if (quantity === null || quantity < 0)
        issue("goldQuantity", "invalidQuantity");
      if (!unitPrice.trim()) issue("unitPrice", "amountRequired");
      gold = {
        unit: unit ?? "gram",
        quantityMilli: quantity ?? 0,
        unitPrice,
      };
    }
    const extra = { rateBp, loan, gold };
    if (data.type !== "credit_card") {
      if (data.type === "loan" || data.type === "gold") rest.spendable = false;
      return { ...rest, ...extra, card: null };
    }
    rest.spendable = false;
    const parse = (schema: z.ZodType<number>, value: string, path: string) => {
      const result = schema.safeParse(value);
      if (!result.success) {
        ctx.addIssue({
          code: "custom",
          path: [path],
          message: result.error.issues[0]!.message,
        });
      }
      return result.data ?? 0;
    };
    const card = {
      statementDay: parse(day, statementDay, "statementDay"),
      dueDay: parse(day, dueDay, "dueDay"),
      minPaymentRate: parse(
        z.coerce
          .number(error("invalidRate"))
          .int(error("invalidRate"))
          .min(0, error("invalidRate"))
          .max(100, error("invalidRate")),
        minPaymentRate,
        "minPaymentRate",
      ),
    };
    return { ...rest, ...extra, card };
  });

export const categorySchema = z.object({
  name: name(40),
  kind: z.enum(CATEGORY_KINDS, error("invalidKind")),
  parentId: optionalId("invalidCategory"),
});

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;

/** Splits "tatil, Yemek ,tatil" into unique tag names: ["tatil", "Yemek"]. */
export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of input.split(",")) {
    const tag = raw.trim().replace(/\s+/g, " ");
    if (!tag || seen.has(tag.toLocaleLowerCase())) continue;
    seen.add(tag.toLocaleLowerCase());
    result.push(tag);
  }
  return result;
}

const tagList = z
  .string()
  .optional()
  .default("")
  .transform(parseTags)
  .refine(
    (list) => list.every((t) => t.length <= MAX_TAG_LENGTH),
    error("tagTooLong"),
  )
  .refine((list) => list.length <= MAX_TAGS, error("tooManyTags"));

const transactionFields = {
  kind: z.enum(TRANSACTION_KINDS, error("invalidKind")),
  accountId: z.uuid(error("accountRequired")),
  toAccountId: optionalId("invalidAccount"),
  categoryId: optionalId("invalidCategory"),
  amount: z.string().trim().min(1, error("amountRequired")),
  /** Only needed for transfers between accounts in different currencies. */
  toAmount: z.string().optional().default(""),
  note: z
    .string()
    .trim()
    .max(500, error("noteTooLong"))
    .optional()
    .transform((v) => v || null),
  tags: tagList,
};

type TransferFields = {
  kind: string;
  accountId: string;
  toAccountId: string | null;
};

function checkTransfer(data: TransferFields, ctx: z.RefinementCtx) {
  if (data.kind !== "transfer") return;
  if (!data.toAccountId) {
    ctx.addIssue({
      code: "custom",
      path: ["toAccountId"],
      ...error("accountRequired"),
    });
  } else if (data.toAccountId === data.accountId) {
    ctx.addIssue({
      code: "custom",
      path: ["toAccountId"],
      ...error("sameAccount"),
    });
  }
}

const count = (max: number, message: ValidationError) =>
  z.coerce
    .number(error(message))
    .int(error(message))
    .min(1, error(message))
    .max(max, error(message));

export const transactionSchema = z
  .object({
    ...transactionFields,
    occurredOn: z.iso.date(error("invalidDate")),
    installments: count(MAX_INSTALLMENTS, "invalidInstallments")
      .optional()
      .default(1),
  })
  .superRefine((data, ctx) => {
    if (data.installments > 1 && data.kind !== "expense") {
      ctx.addIssue({
        code: "custom",
        path: ["installments"],
        ...error("invalidInstallments"),
      });
    }
    checkTransfer(data, ctx);
  });

export const RECURRING_ENDS = ["never", "onDate", "afterCount"] as const;

export const recurringSchema = z
  .object({
    ...transactionFields,
    startOn: z.iso.date(error("invalidDate")),
    frequency: z.enum(FREQUENCIES, error("invalidFrequency")),
    interval: count(MAX_INTERVAL, "invalidInterval").optional().default(1),
    ends: z
      .enum(RECURRING_ENDS, error("invalidFrequency"))
      .optional()
      .default("never"),
    endOn: z.string().optional().default(""),
    maxOccurrences: z.string().optional().default(""),
  })
  .superRefine(checkTransfer)
  .transform((data, ctx) => {
    const { ends, endOn, maxOccurrences, ...rest } = data;
    let end = {
      endOn: null as string | null,
      maxOccurrences: null as number | null,
    };
    if (ends === "onDate") {
      const parsed = z.iso.date().safeParse(endOn);
      if (!parsed.success || parsed.data < data.startOn) {
        ctx.addIssue({
          code: "custom",
          path: ["endOn"],
          ...error("invalidEndDate"),
        });
      } else {
        end = { ...end, endOn: parsed.data };
      }
    } else if (ends === "afterCount") {
      const parsed = count(MAX_OCCURRENCES, "invalidOccurrences").safeParse(
        maxOccurrences,
      );
      if (!parsed.success) {
        ctx.addIssue({
          code: "custom",
          path: ["maxOccurrences"],
          ...error("invalidOccurrences"),
        });
      } else {
        end = { ...end, maxOccurrences: parsed.data };
      }
    }
    return { ...rest, ...end };
  });

const month = z.iso
  .date(error("invalidDate"))
  .refine((v) => v.endsWith("-01"), error("invalidDate"));

export const budgetSchema = z.object({
  categoryId: z.uuid(error("categoryRequired")),
  amount: z.string().trim().min(1, error("amountRequired")),
  /** First day of the month the limit applies from. */
  month,
});

export const goalSchema = z.object({
  name: name(60),
  targetAmount: z.string().trim().min(1, error("amountRequired")),
  currency: z.enum(currencyCodes, error("invalidCurrency")),
  targetDate: z
    .string()
    .optional()
    .transform((v) => v || null)
    .pipe(z.iso.date(error("invalidDate")).nullable()),
  /** Progress follows this account's balance instead of contributions. */
  accountId: optionalId("invalidAccount"),
});

export const CONTRIBUTION_DIRECTIONS = ["deposit", "withdraw"] as const;

export const contributionSchema = z.object({
  direction: z.enum(CONTRIBUTION_DIRECTIONS, error("invalidKind")),
  amount: z.string().trim().min(1, error("amountRequired")),
  occurredOn: z.iso.date(error("invalidDate")),
  note: z
    .string()
    .trim()
    .max(200, error("noteTooLong"))
    .optional()
    .transform((v) => v || null),
});

export const ENVELOPE_REPEATS = [0, 1, 3, 6, 12] as const;

export const envelopeSchema = z.object({
  name: name(60),
  amount: z.string().trim().min(1, error("amountRequired")),
  dueOn: z.iso.date(error("invalidDate")),
  /** Months between payments; 0 for a one-time payment. */
  repeat: z.coerce
    .number(error("invalidFrequency"))
    .refine(
      (v) => (ENVELOPE_REPEATS as readonly number[]).includes(v),
      error("invalidFrequency"),
    )
    .optional()
    .default(0)
    .transform((v) => v || null),
});

/**
 * Parses an amount field typed in the user's notation. Returns the amount in
 * minor units, or the error to show next to the field.
 */
export function parseAmount(
  input: string,
  currency: CurrencyCode,
  locale: string,
  { allowNegative = false, allowZero = false } = {},
): { amount: MinorUnits } | { error: ValidationError } {
  const amount = parseMoney(input, currency, locale);
  if (amount === null) return { error: "invalidAmount" };
  if (amount < 0 && !allowNegative) return { error: "amountNotPositive" };
  if (amount === 0 && !allowZero) return { error: "amountNotPositive" };
  return { amount };
}
