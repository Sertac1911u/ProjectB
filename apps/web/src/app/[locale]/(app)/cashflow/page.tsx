import { formatMoney, isCurrencyCode } from "@projectb/core";
import { Pencil, Plus } from "lucide-react";
import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AccountIcon } from "@/components/finance/account-icon";
import { Amount } from "@/components/finance/amount";
import { CashTimeline } from "@/components/finance/cash-timeline";
import { SafeToSpend } from "@/components/finance/safe-to-spend";
import { WhatIfForm } from "@/components/finance/what-if-form";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { AccountWithBalance } from "@/lib/data/finance";
import {
  type CashForecast,
  getCashForecast,
  HORIZON_DAYS,
} from "@/lib/data/cashflow";
import { formatDay } from "@/lib/dates";

export default async function CashFlowPage() {
  const t = await getTranslations("CashFlow");
  return (
    <div className="max-w-4xl">
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense
        fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}
      >
        <CashFlow />
      </Suspense>
    </div>
  );
}

async function CashFlow() {
  // The forecast starts from today's date.
  await connection();
  const [forecast, locale, t, tWhatIf] = await Promise.all([
    getCashForecast(),
    getLocale(),
    getTranslations("CashFlow"),
    getTranslations("WhatIf"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <SafeToSpend forecast={forecast} />
      <p className="text-xs text-muted-foreground">{t("howItWorks")}</p>

      {forecast.spendable.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{tWhatIf("title")}</CardTitle>
            <CardDescription>{tWhatIf("hint")}</CardDescription>
          </CardHeader>
          <div className="px-6 pb-6">
            <WhatIfForm
              currency={forecast.currency}
              cards={forecast.cards.map((c) => ({ id: c.id, name: c.name }))}
            />
          </div>
        </Card>
      )}

      <Envelopes forecast={forecast} locale={locale} />

      <Card>
        <CardHeader>
          <CardTitle>{t("calendar")}</CardTitle>
          <CardDescription>
            {t("calendarHint", { days: HORIZON_DAYS })}
          </CardDescription>
        </CardHeader>
        <div className="border-t">
          <CashTimeline forecast={forecast} />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("regular")}</CardTitle>
          <CardDescription>{t("regularHint")}</CardDescription>
        </CardHeader>
        <div className="flex flex-wrap gap-2 px-6 pb-6">
          {!forecast.hasIncomeRule && (
            <Link
              href={{ pathname: "/recurring/new", query: { kind: "income" } }}
              className={buttonVariants()}
            >
              <Plus />
              {t("addSalary")}
            </Link>
          )}
          <Link
            href={{ pathname: "/recurring/new", query: { kind: "expense" } }}
            className={buttonVariants({ variant: "outline" })}
          >
            <Plus />
            {t("addPayment")}
          </Link>
          {forecast.hasRules && (
            <Link
              href="/recurring"
              className={buttonVariants({ variant: "ghost" })}
            >
              {t("seeAll")}
            </Link>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("accounts")}</CardTitle>
          <CardDescription>{t("accountsHint")}</CardDescription>
        </CardHeader>
        <AccountRows accounts={forecast.spendable} locale={locale} />
        {forecast.others.length > 0 && (
          <>
            <p className="border-t px-6 pt-4 pb-1 text-xs font-medium text-muted-foreground">
              {t("notCounted")}
            </p>
            <div className="opacity-60">
              <AccountRows accounts={forecast.others} locale={locale} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

async function AccountRows({
  accounts,
  locale,
}: {
  accounts: AccountWithBalance[];
  locale: string;
}) {
  const tCommon = await getTranslations("Common");
  return (
    <ul className="divide-y border-t">
      {accounts.map((account) => (
        <li key={account.id} className="flex items-center gap-3 px-6 py-3">
          <AccountIcon type={account.type} />
          <span className="min-w-0 flex-1 truncate font-medium">
            {account.name}
          </span>
          <Amount
            value={account.balance}
            currency={account.currency}
            locale={locale}
          />
          <Link
            href={`/accounts/${account.id}/edit`}
            aria-label={`${tCommon("edit")}: ${account.name}`}
            className={buttonVariants({ variant: "ghost", size: "icon" })}
          >
            <Pencil />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Envelopes for rare payments, with what each should hold by now. */
async function Envelopes({
  forecast,
  locale,
}: {
  forecast: CashForecast;
  locale: string;
}) {
  const t = await getTranslations("Envelopes");
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("hint")}</CardDescription>
        </div>
        <Link
          href="/cashflow/envelopes/new"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Plus />
          {t("new")}
        </Link>
      </CardHeader>
      {forecast.envelopes.length === 0 ? (
        <p className="px-6 pb-6 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y border-t">
          {forecast.envelopes.map((envelope) => (
            <li key={envelope.id}>
              <Link
                href={`/cashflow/envelopes/${envelope.id}`}
                className="flex flex-col gap-2 px-6 py-4 transition-colors hover:bg-muted/60"
              >
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-medium">{envelope.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {t("due", {
                      date: formatDay(envelope.cycle.due, locale),
                      amount: formatMoney(
                        envelope.amount,
                        isCurrencyCode(envelope.currency)
                          ? envelope.currency
                          : "TRY",
                        locale,
                      ),
                    })}
                  </span>
                </span>
                <Progress
                  value={envelope.cycle.percent}
                  label={envelope.name}
                />
                <span className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
                  <span>
                    {t("reservedSoFar", {
                      amount: formatMoney(
                        envelope.cycle.reserved,
                        isCurrencyCode(envelope.currency)
                          ? envelope.currency
                          : "TRY",
                        locale,
                      ),
                    })}
                  </span>
                  <span>
                    {t("monthly", {
                      amount: formatMoney(
                        envelope.cycle.monthly,
                        isCurrencyCode(envelope.currency)
                          ? envelope.currency
                          : "TRY",
                        locale,
                      ),
                    })}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
