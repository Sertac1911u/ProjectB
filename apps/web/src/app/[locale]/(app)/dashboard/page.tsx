import { DEFAULT_CURRENCY, isCurrencyCode } from "@projectb/core";
import { Plus, Wallet } from "lucide-react";
import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Amount } from "@/components/finance/amount";
import { TransactionList } from "@/components/finance/transaction-list";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { getProfile } from "@/lib/auth";
import {
  getAccounts,
  getCategories,
  getTotals,
  listTransactions,
} from "@/lib/data/finance";
import { monthRange, today } from "@/lib/dates";

export default function DashboardPage() {
  return (
    <>
      <Suspense
        fallback={
          <div className="mb-6 h-8 w-48 animate-pulse rounded bg-muted" />
        }
      >
        <Greeting />
      </Suspense>
      <Suspense
        fallback={<div className="h-28 animate-pulse rounded-xl bg-muted" />}
      >
        <Summary />
      </Suspense>
      <Suspense
        fallback={
          <div className="mt-6 h-64 animate-pulse rounded-xl bg-muted" />
        }
      >
        <Recent />
      </Suspense>
    </>
  );
}

async function Greeting() {
  const [profile, t, tTransactions] = await Promise.all([
    getProfile(),
    getTranslations("Dashboard"),
    getTranslations("Transactions"),
  ]);
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">
        {profile.displayName
          ? t("greeting", { name: profile.displayName })
          : t("greetingNoName")}
      </h1>
      <Link href="/transactions/new" className={buttonVariants()}>
        <Plus />
        {tTransactions("new")}
      </Link>
    </div>
  );
}

async function Summary() {
  // "This month" depends on the current date, so it is computed per request.
  await connection();
  const { from, to } = monthRange(today());
  const [profile, accounts, totals, locale, t] = await Promise.all([
    getProfile(),
    getAccounts(),
    getTotals(from, to),
    getLocale(),
    getTranslations("Dashboard"),
  ]);
  const currency = isCurrencyCode(profile.baseCurrency)
    ? profile.baseCurrency
    : DEFAULT_CURRENCY;
  const active = accounts.filter((a) => !a.archivedAt);

  if (active.length === 0) {
    const tAccounts = await getTranslations("Accounts");
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Wallet className="size-5" />
        </span>
        <p className="font-medium">{tAccounts("emptyTitle")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {tAccounts("emptyDescription")}
        </p>
        <Link
          href="/accounts/new"
          className={buttonVariants({ className: "mt-2" })}
        >
          <Plus />
          {tAccounts("addFirst")}
        </Link>
      </Card>
    );
  }

  // Until exchange rates exist (phase 4), only the main currency is summed.
  const netWorth = active
    .filter((a) => a.currency === currency)
    .reduce((sum, a) => sum + a.balance, 0);
  const total = (kind: string) =>
    totals.find((row) => row.currency === currency && row.kind === kind)
      ?.total ?? 0;
  const otherCurrencies = active.some((a) => a.currency !== currency);

  const cards = [
    { key: "netWorth", value: netWorth, kind: undefined },
    { key: "income", value: total("income"), kind: "income" },
    { key: "expense", value: total("expense"), kind: "expense" },
  ] as const;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.key}>
            <CardHeader>
              <CardDescription>{t(card.key)}</CardDescription>
              <Amount
                value={card.value}
                currency={currency}
                locale={locale}
                kind={card.kind}
                className="text-2xl font-semibold"
              />
            </CardHeader>
          </Card>
        ))}
      </div>
      {otherCurrencies && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("otherCurrencies", { currency })}
        </p>
      )}
    </>
  );
}

async function Recent() {
  const [{ rows }, categories, t] = await Promise.all([
    listTransactions({}, 1),
    getCategories(),
    getTranslations("Dashboard"),
  ]);
  if (rows.length === 0) return null;
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("recent")}</h2>
        <Link
          href="/transactions"
          className="text-sm font-medium text-primary hover:underline"
        >
          {t("seeAll")}
        </Link>
      </div>
      <TransactionList rows={rows.slice(0, 5)} categories={categories} />
    </section>
  );
}
