import {
  addMonths,
  budgetToFinishIn,
  convert,
  type CurrencyCode,
  DEBT_STRATEGIES,
  type Debt,
  DEFAULT_CURRENCY,
  formatAmountInput,
  formatMoney,
  formatScaled,
  isCurrencyCode,
  monthOf,
  occurrenceDate,
  parseMoney,
  planDebts,
  RATE_DECIMALS,
  wholeMonths,
} from "@projectb/core";
import { HandCoins, Plus } from "lucide-react";
import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AccountIcon } from "@/components/finance/account-icon";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { getProfile } from "@/lib/auth";
import { getCashForecast } from "@/lib/data/cashflow";
import { getAccounts } from "@/lib/data/finance";
import { getRates } from "@/lib/data/rates";
import { formatDay, today } from "@/lib/dates";
import { cn } from "@/lib/utils";

type SearchParams = PageProps<"/[locale]/debts">["searchParams"];

/** Extra monthly payment the page tries out, in whole units of the currency. */
const EXTRA_UNITS = 1_000;

export default async function DebtsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const t = await getTranslations("Debts");
  return (
    <div className="max-w-5xl">
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense
        fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}
      >
        <DebtPlans searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function DebtPlans({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  // Payoff dates count from today.
  await connection();
  const [accounts, rateInfo, profile, forecast, locale, t, tCommon] =
    await Promise.all([
      getAccounts(),
      getRates(),
      getProfile(),
      getCashForecast(),
      getLocale(),
      getTranslations("Debts"),
      getTranslations("Common"),
    ]);
  const currency: CurrencyCode = isCurrencyCode(profile.baseCurrency)
    ? profile.baseCurrency
    : DEFAULT_CURRENCY;
  const money = (v: number) => formatMoney(v, currency, locale);
  const toBase = (amount: number, from: string) =>
    convert(
      amount,
      isCurrencyCode(from) ? from : DEFAULT_CURRENCY,
      currency,
      rateInfo.rates,
    ) ?? 0;

  const owing = accounts.filter(
    (a) =>
      !a.archivedAt &&
      (a.type === "loan" || a.type === "credit_card") &&
      a.balance < 0,
  );
  if (owing.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <HandCoins className="size-5" />
        </span>
        <p className="max-w-sm text-sm text-muted-foreground">{t("empty")}</p>
        <Link
          href="/accounts/new"
          className={buttonVariants({ className: "mt-2" })}
        >
          <Plus />
          {t("addLoan")}
        </Link>
      </Card>
    );
  }

  const debts: (Debt & { name: string; type: string; rated: boolean })[] =
    owing.map((a) => {
      const balance = toBase(-a.balance, a.currency);
      const minimum =
        a.type === "loan"
          ? toBase(a.loanPayment ?? Math.ceil(-a.balance / 100), a.currency)
          : Math.round((balance * (a.minPaymentRate ?? 20)) / 100);
      return {
        id: a.id,
        name: a.name,
        type: a.type,
        balance,
        monthlyRate: (a.interestRateBp ?? 0) / 10_000,
        minimumPayment: Math.min(balance, Math.max(minimum, 1)),
        rated: a.interestRateBp !== null,
      };
    });
  const minimums = debts.reduce((sum, d) => sum + d.minimumPayment, 0);
  const typed =
    typeof params.budget === "string"
      ? parseMoney(params.budget, currency, locale)
      : null;
  const budget = Math.max(minimums, typed ?? minimums);
  const target =
    typeof params.target === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(params.target)
      ? params.target
      : "";

  const day = today();
  // Payments go out on payday when it is known, otherwise on the 1st.
  const firstPayment = forecast.payday ?? addMonths(monthOf(day), 1);
  const paymentDate = (month: number) =>
    occurrenceDate(
      { startOn: firstPayment, frequency: "monthly", interval: 1 },
      month - 1,
    );
  const plans = DEBT_STRATEGIES.map((strategy) => ({
    strategy,
    plan: planDebts(debts, budget, strategy, 6),
  }));
  const cheapest = Math.min(...plans.map((p) => p.plan.totalInterest));
  const best = planDebts(debts, budget, "highestRate");
  const extra = EXTRA_UNITS * 100;
  const withExtra = planDebts(debts, budget + extra, "highestRate");
  const needed = target
    ? budgetToFinishIn(debts, wholeMonths(day, target), "highestRate")
    : null;
  const name = (id: string) => debts.find((d) => d.id === id)?.name ?? "";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("list")}</CardTitle>
          {debts.some((d) => !d.rated) && (
            <CardDescription>{t("rateMissingHint")}</CardDescription>
          )}
        </CardHeader>
        <div className="overflow-x-auto border-t">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="px-6 py-2 text-left font-medium" />
                <th className="px-3 py-2 text-right font-medium">
                  {t("balance")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("rate")}
                </th>
                <th className="px-6 py-2 text-right font-medium">
                  {t("minimum")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y tabular-nums">
              {debts.map((debt) => (
                <tr key={debt.id}>
                  <td className="px-6 py-3">
                    <Link
                      href={`/accounts/${debt.id}/edit`}
                      className="flex items-center gap-2 font-medium hover:underline"
                    >
                      <AccountIcon type={debt.type} className="size-7" />
                      {debt.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {money(debt.balance)}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-3 text-right",
                      !debt.rated && "text-muted-foreground",
                    )}
                  >
                    {debt.rated
                      ? `%${formatScaled(Math.round(debt.monthlyRate * 10_000), RATE_DECIMALS, locale)}`
                      : t("rateMissing")}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {money(debt.minimumPayment)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-6">
        <form className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <Field
            id="debt-budget"
            label={t("budget", { currency })}
            hint={t("budgetHint", { amount: money(minimums) })}
          >
            <Input
              id="debt-budget"
              name="budget"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={formatAmountInput(budget, currency, locale)}
            />
          </Field>
          <Field
            id="debt-target"
            label={`${t("targetDate")} (${tCommon("optional")})`}
          >
            <Input
              id="debt-target"
              name="target"
              type="date"
              min={day}
              defaultValue={target}
            />
          </Field>
          <Button type="submit" className="mb-0.5">
            {t("calculate")}
          </Button>
        </form>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {plans.map(({ strategy, plan }) => (
          <Card
            key={strategy}
            className={cn(
              "flex flex-col gap-3 p-6",
              plan.months !== null &&
                plan.totalInterest === cheapest &&
                plans.some((p) => p.plan.totalInterest !== cheapest) &&
                "border-primary/50",
            )}
          >
            <div>
              <p className="font-semibold">{t(`strategies.${strategy}`)}</p>
              <p className="text-sm text-muted-foreground">
                {t(`strategyHints.${strategy}`)}
              </p>
            </div>
            {plan.months === null ? (
              <p className="text-sm text-destructive">{t("never")}</p>
            ) : (
              <>
                <p className="text-lg font-semibold">
                  {t("finish", {
                    months: plan.months,
                    date: formatDay(paymentDate(plan.months), locale),
                  })}
                </p>
                <p className="text-sm">
                  {t("interest", { amount: money(plan.totalInterest) })}
                  {plan.totalInterest > cheapest && (
                    <span className="text-muted-foreground">
                      {" · "}
                      {t("moreInterest", {
                        amount: money(plan.totalInterest - cheapest),
                      })}
                    </span>
                  )}
                </p>
                <div className="text-sm">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    {t("order")}
                  </p>
                  <ol className="flex flex-col gap-0.5">
                    {Object.entries(plan.payoffMonth)
                      .sort((a, b) => a[1] - b[1])
                      .map(([id, month], i) => (
                        <li key={id} className="flex justify-between gap-3">
                          <span>
                            {i + 1}. {name(id)}
                          </span>
                          <span className="text-muted-foreground">
                            {t("paidOff", {
                              date: formatDay(
                                paymentDate(month),
                                locale,
                                "medium",
                              ),
                            })}
                          </span>
                        </li>
                      ))}
                  </ol>
                </div>
              </>
            )}
          </Card>
        ))}
      </div>

      {best.months !== null && withExtra.months !== null && (
        <Card className="flex flex-col gap-1 p-6 text-sm">
          <p className="font-medium">{t("extra", { amount: money(extra) })}</p>
          <p className="text-muted-foreground">
            {best.months > withExtra.months
              ? t("extraResult", {
                  months: best.months - withExtra.months,
                  interest: money(best.totalInterest - withExtra.totalInterest),
                })
              : t("extraSame", {
                  interest: money(best.totalInterest - withExtra.totalInterest),
                })}
          </p>
        </Card>
      )}

      {target && (
        <Card className="flex flex-col gap-1 p-6 text-sm">
          <p className="font-medium">
            {t("byDate")}: {formatDay(target, locale)}
          </p>
          <p className="text-muted-foreground">
            {needed === null
              ? t("neededImpossible")
              : t("needed", { amount: money(needed) })}
          </p>
        </Card>
      )}

      {best.months !== null && (
        <Card>
          <CardHeader>
            <CardTitle>{t("schedule")}</CardTitle>
            <CardDescription>
              {t(`strategies.highestRate`)}
              {forecast.payday &&
                ` · ${t("payday", { date: formatDay(firstPayment, locale) })}`}
            </CardDescription>
          </CardHeader>
          <div className="overflow-x-auto border-t">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="px-6 py-2 text-left font-medium" />
                  {debts.map((d) => (
                    <th key={d.id} className="px-3 py-2 text-right font-medium">
                      {d.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y tabular-nums">
                {planDebts(debts, budget, "highestRate", 6).schedule.map(
                  (row) => (
                    <tr key={row.month}>
                      <td className="px-6 py-2 whitespace-nowrap">
                        {formatDay(paymentDate(row.month), locale, "medium")}
                      </td>
                      {debts.map((d) => (
                        <td key={d.id} className="px-3 py-2 text-right">
                          {row.payments[d.id]
                            ? money(row.payments[d.id]!)
                            : "—"}
                        </td>
                      ))}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
