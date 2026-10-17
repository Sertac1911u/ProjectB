import { z } from "zod";
import { CURRENCIES, type CurrencyCode } from "./currency";
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

export const accountSchema = z.object({
  name: name(60),
  type: z.enum(ACCOUNT_TYPES, error("invalidAccountType")),
  currency: z.enum(currencyCodes, error("invalidCurrency")),
  /** Typed by the user in their locale's notation; parsed with parseAmount. */
  openingBalance: z.string().optional().default(""),
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

export const transactionSchema = z
  .object({
    kind: z.enum(TRANSACTION_KINDS, error("invalidKind")),
    accountId: z.uuid(error("accountRequired")),
    toAccountId: optionalId("invalidAccount"),
    categoryId: optionalId("invalidCategory"),
    amount: z.string().trim().min(1, error("amountRequired")),
    /** Only needed for transfers between accounts in different currencies. */
    toAmount: z.string().optional().default(""),
    occurredOn: z.iso.date(error("invalidDate")),
    note: z
      .string()
      .trim()
      .max(500, error("noteTooLong"))
      .optional()
      .transform((v) => v || null),
    tags: tagList,
  })
  .superRefine((data, ctx) => {
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
