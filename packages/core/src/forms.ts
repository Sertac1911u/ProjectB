import { z } from "zod";
import { CURRENCIES, type CurrencyCode } from "./currency";
import { MAX_INSTALLMENTS } from "./card";
import { FREQUENCIES, MAX_INTERVAL, MAX_OCCURRENCES } from "./recurring";
import { ACCOUNT_TYPES, CATEGORY_KINDS, TRANSACTION_KINDS } from "./finance";
import { type MinorUnits, parseMoney } from "./money";
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
  })
  .transform((data, ctx) => {
    const { statementDay, dueDay, minPaymentRate, ...rest } = data;
    if (data.type !== "credit_card") {
      return { ...rest, card: null };
    }
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
    return { ...rest, card };
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
