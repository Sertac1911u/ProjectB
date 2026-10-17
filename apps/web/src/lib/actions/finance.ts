"use server";

import {
  accountSchema,
  categorySchema,
  type CurrencyCode,
  fieldErrors,
  isCurrencyCode,
  LOCALES,
  type Locale,
  parseAmount,
  transactionSchema,
  type ValidationError,
} from "@projectb/core";
import {
  accounts,
  categories,
  tags,
  transactions,
  transactionTags,
  type Tx,
} from "@projectb/db";
import { eq, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { withUser } from "@/lib/auth";
import { categoryName } from "@/lib/categories";
import type { FormState } from "./state";

const values = (formData: FormData) =>
  Object.fromEntries(
    [...formData.entries()].filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );

// Accounts --------------------------------------------------------------------

export async function saveAccount(
  locale: Locale,
  accountId: string | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const submitted = values(formData);
  const parsed = accountSchema.safeParse(submitted);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: fieldErrors(parsed.error),
      values: submitted,
    };
  }
  const { name, type, currency, openingBalance } = parsed.data;
  const opening = openingBalance.trim()
    ? parseAmount(openingBalance, currency, locale, {
        allowNegative: true,
        allowZero: true,
      })
    : { amount: 0 };
  if ("error" in opening) {
    return {
      status: "error",
      fieldErrors: { openingBalance: opening.error },
      values: submitted,
    };
  }

  await withUser(async (tx) => {
    if (!accountId) {
      await tx
        .insert(accounts)
        .values({ name, type, currency, openingBalance: opening.amount });
      return;
    }
    // The currency is fixed once transactions use the account.
    const used = await tx
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        or(
          eq(transactions.accountId, accountId),
          eq(transactions.toAccountId, accountId),
        ),
      )
      .limit(1);
    await tx
      .update(accounts)
      .set({
        name,
        type,
        openingBalance: opening.amount,
        ...(used.length === 0 && { currency }),
      })
      .where(eq(accounts.id, accountId));
  });
  redirect(`/${locale}/accounts`);
}

export async function setAccountArchived(
  locale: Locale,
  accountId: string,
  archived: boolean,
) {
  await withUser((tx) =>
    tx
      .update(accounts)
      .set({ archivedAt: archived ? new Date() : null })
      .where(eq(accounts.id, accountId)),
  );
  redirect(`/${locale}/accounts`);
}

export async function deleteAccount(
  locale: Locale,
  accountId: string,
): Promise<FormState> {
  const deleted = await withUser(async (tx) => {
    const used = await tx
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        or(
          eq(transactions.accountId, accountId),
          eq(transactions.toAccountId, accountId),
        ),
      )
      .limit(1);
    if (used.length > 0) return false;
    await tx.delete(accounts).where(eq(accounts.id, accountId));
    return true;
  });
  if (!deleted) return { status: "error", error: "accountHasTransactions" };
  redirect(`/${locale}/accounts`);
}

// Transactions ----------------------------------------------------------------

async function currencyOf(
  tx: Tx,
  accountId: string,
): Promise<CurrencyCode | null> {
  const [row] = await tx
    .select({ currency: accounts.currency })
    .from(accounts)
    .where(eq(accounts.id, accountId));
  return row && isCurrencyCode(row.currency) ? row.currency : null;
}

async function saveTags(tx: Tx, transactionId: string, names: string[]) {
  await tx
    .delete(transactionTags)
    .where(eq(transactionTags.transactionId, transactionId));
  if (names.length === 0) return;
  const list = sql`array[${sql.join(
    names.map((name) => sql`${name}`),
    sql`, `,
  )}]::text[]`;
  // Postgres compares the names, so case folding matches the unique index.
  await tx.execute(sql`
    insert into ${tags} (name) select unnest(${list})
    on conflict (user_id, lower(name)) do nothing
  `);
  await tx.execute(sql`
    insert into ${transactionTags} (transaction_id, tag_id)
    select ${transactionId}, ${tags.id} from ${tags}
    where lower(${tags.name}) = any (select lower(n) from unnest(${list}) as n)
    on conflict do nothing
  `);
}

export async function saveTransaction(
  locale: Locale,
  transactionId: string | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const submitted = values(formData);
  const parsed = transactionSchema.safeParse(submitted);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: fieldErrors(parsed.error),
      values: submitted,
    };
  }
  const data = parsed.data;
  const isTransfer = data.kind === "transfer";
  const fail = (field: string, error: ValidationError): FormState => ({
    status: "error",
    fieldErrors: { [field]: error },
    values: submitted,
  });

  const result = await withUser(async (tx): Promise<FormState | null> => {
    // Reading through row level security also proves the user owns them.
    const currency = await currencyOf(tx, data.accountId);
    if (!currency) return fail("accountId", "invalidAccount");
    const toCurrency = isTransfer
      ? await currencyOf(tx, data.toAccountId!)
      : null;
    if (isTransfer && !toCurrency) return fail("toAccountId", "invalidAccount");

    const amount = parseAmount(data.amount, currency, locale);
    if ("error" in amount) return fail("amount", amount.error);

    let toAmount: number | null = null;
    if (isTransfer) {
      if (toCurrency === currency || !data.toAmount.trim()) {
        if (toCurrency !== currency) return fail("toAmount", "amountRequired");
        toAmount = amount.amount;
      } else {
        const parsedTo = parseAmount(data.toAmount, toCurrency!, locale);
        if ("error" in parsedTo) return fail("toAmount", parsedTo.error);
        toAmount = parsedTo.amount;
      }
    }

    let categoryId = isTransfer ? null : data.categoryId;
    if (categoryId) {
      const [category] = await tx
        .select({ kind: categories.kind })
        .from(categories)
        .where(eq(categories.id, categoryId));
      if (!category || category.kind !== data.kind)
        return fail("categoryId", "invalidCategory");
    } else {
      categoryId = null;
    }

    const row = {
      kind: data.kind,
      accountId: data.accountId,
      toAccountId: isTransfer ? data.toAccountId : null,
      amount: amount.amount,
      toAmount,
      categoryId,
      occurredOn: data.occurredOn,
      note: data.note,
    };
    let id = transactionId;
    if (id) {
      const updated = await tx
        .update(transactions)
        .set(row)
        .where(eq(transactions.id, id))
        .returning({ id: transactions.id });
      if (updated.length === 0) return { status: "error", error: "unknown" };
    } else {
      const [inserted] = await tx
        .insert(transactions)
        .values(row)
        .returning({ id: transactions.id });
      id = inserted!.id;
    }
    await saveTags(tx, id, data.tags);
    return null;
  });

  if (result) return result;
  redirect(`/${locale}/transactions`);
}

export async function deleteTransaction(locale: Locale, transactionId: string) {
  await withUser((tx) =>
    tx.delete(transactions).where(eq(transactions.id, transactionId)),
  );
  redirect(`/${locale}/transactions`);
}

// Categories and tags ---------------------------------------------------------

export async function saveCategory(
  locale: Locale,
  categoryId: string | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const submitted = values(formData);
  const parsed = categorySchema.safeParse(submitted);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: fieldErrors(parsed.error),
      values: submitted,
    };
  }
  const { name, parentId } = parsed.data;

  const result = await withUser(async (tx): Promise<FormState | null> => {
    const existing = categoryId
      ? (
          await tx
            .select()
            .from(categories)
            .where(eq(categories.id, categoryId))
        )[0]
      : undefined;
    if (categoryId && !existing) return { status: "error", error: "unknown" };
    // The type of an existing category never changes: transactions rely on it.
    const kind = existing?.kind ?? parsed.data.kind;

    if (parentId) {
      const [parent] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, parentId));
      if (!parent || parent.kind !== kind || parent.id === categoryId) {
        return {
          status: "error",
          fieldErrors: { parentId: "invalidCategory" },
          values: submitted,
        };
      }
      const hasChildren =
        categoryId &&
        (
          await tx
            .select({ id: categories.id })
            .from(categories)
            .where(eq(categories.parentId, categoryId))
        ).length > 0;
      if (parent.parentId || hasChildren) {
        return { status: "error", error: "categoryNesting", values: submitted };
      }
    }

    if (existing) {
      await tx
        .update(categories)
        .set({
          name: (await isDefaultName(existing.systemKey, name)) ? null : name,
          parentId,
        })
        .where(eq(categories.id, existing.id));
    } else {
      await tx.insert(categories).values({ name, kind, parentId });
    }
    return null;
  });

  if (result) return result;
  redirect(`/${locale}/settings/categories`);
}

/**
 * Whether `name` is the translated default name of a built-in category in
 * any language. Then no custom name is stored, so it keeps being translated.
 */
async function isDefaultName(systemKey: string | null, name: string) {
  if (!systemKey) return false;
  const names = await Promise.all(
    LOCALES.map(async (locale) => {
      const t = await getTranslations({ locale, namespace: "Categories" });
      return categoryName({ name: null, systemKey }, t);
    }),
  );
  return names.includes(name);
}

export async function setCategoryArchived(
  locale: Locale,
  categoryId: string,
  archived: boolean,
) {
  await withUser((tx) =>
    tx
      .update(categories)
      .set({ archivedAt: archived ? new Date() : null })
      .where(
        or(eq(categories.id, categoryId), eq(categories.parentId, categoryId)),
      ),
  );
  redirect(`/${locale}/settings/categories`);
}

export async function deleteTag(locale: Locale, tagId: string) {
  await withUser((tx) => tx.delete(tags).where(eq(tags.id, tagId)));
  redirect(`/${locale}/settings/categories`);
}
