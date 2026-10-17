export const ACCOUNT_TYPES = [
  "cash",
  "bank",
  "credit_card",
  "savings",
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
