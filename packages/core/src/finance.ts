export const ACCOUNT_TYPES = [
  "cash",
  "bank",
  "credit_card",
  "savings",
  "loan",
  "gold",
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const TRANSACTION_KINDS = ["expense", "income", "transfer"] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

export const CATEGORY_KINDS = ["expense", "income"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

/**
 * Keys of the categories every new user starts with, parents mapped to their
 * subcategories. The sign-up trigger in packages/db creates the same list.
 */
export const DEFAULT_CATEGORIES: Record<
  CategoryKind,
  Record<string, string[]>
> = {
  expense: {
    groceries: [],
    dining: [],
    transport: ["fuel", "public_transport", "taxi"],
    housing: ["rent", "dues"],
    bills: ["electricity", "water", "natural_gas", "internet", "phone"],
    health: [],
    shopping: ["clothing", "electronics"],
    entertainment: [],
    subscriptions: [],
    education: [],
    personal_care: [],
    gifts_donations: [],
    other_expense: [],
  },
  income: {
    salary: [],
    side_income: [],
    investment_income: [],
    gifts_received: [],
    other_income: [],
  },
};

export function isAccountType(value: unknown): value is AccountType {
  return ACCOUNT_TYPES.includes(value as AccountType);
}

/** How much of the app is shown: the essentials, or every feature. */
export const UI_MODES = ["simple", "detailed"] as const;
export type UiMode = (typeof UI_MODES)[number];
export const isUiMode = (value: unknown): value is UiMode =>
  UI_MODES.includes(value as UiMode);

/** Account types counted as money to spend by default. */
export const SPENDABLE_BY_DEFAULT: readonly AccountType[] = ["cash", "bank"];

/** Accounts that are a debt: their balance is what is owed (negative). */
export const DEBT_TYPES: readonly AccountType[] = ["credit_card", "loan"];

/** Gold is held in grams or in coins. */
export const GOLD_UNITS = ["gram", "quarter", "half", "full"] as const;
export type GoldUnit = (typeof GOLD_UNITS)[number];

/** Gold quantities are stored in thousandths: 12,5 gram is 12500. */
export const QUANTITY_DECIMALS = 3;

/** Value of a gold holding: quantity (thousandths) × price per unit. */
export const goldValue = (quantityMilli: number, unitPrice: number) =>
  Math.round((quantityMilli * unitPrice) / 10 ** QUANTITY_DECIMALS);

/** Interest rates are monthly percentages stored in hundredths: 3,49% is 349. */
export const RATE_DECIMALS = 2;
