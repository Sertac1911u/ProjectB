import {
  DEFAULT_CURRENCY,
  isCurrencyCode,
  monthOf,
  periodRange,
  sumIn,
} from "@projectb/core";
import { ArrowRight, Plus, ShieldCheck } from "lucide-react";
import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { Sparkline } from "@/components/charts/sparkline";
import { Amount } from "@/components/finance/amount";
import { CashTimeline } from "@/components/finance/cash-timeline";
import { SafeToSpend } from "@/components/finance/safe-to-spend";
import { WelcomeMode } from "@/components/welcome-mode";
import { GoalSummary } from "@/components/finance/goal-card";
import { RatesNote } from "@/components/finance/rates-note";
import { TransactionList } from "@/components/finance/transaction-list";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import { getProfile } from "@/lib/auth";
import { getCashForecast } from "@/lib/data/cashflow";
import { getResilience } from "@/lib/data/resilience";
import { uiModeOf } from "@/lib/ui-mode";
import { categoryName, categoryPath } from "@/lib/categories";
import {
  getAccounts,
  getCategories,
  getTotals,
  listTransactions,
} from "@/lib/data/finance";
import { getBudgetOverview, getGoals } from "@/lib/data/planning";
import { getRates } from "@/lib/data/rates";
import {
  getCashFlow,
  getCategoryBreakdown,
  getNetWorthHistory,
} from "@/lib/data/reports";
import { monthRange, today } from "@/lib/dates";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  return (
    <>
      <Suspense fallback={null}>
        <Preload />
      </Suspense>
      <Suspense
        fallback={
          <div className="mb-6 h-8 w-48 animate-pulse rounded bg-muted" />
        }
      >
        <Greeting />
      </Suspense>
      <Suspense fallback={null}>
        <Welcome />
      </Suspense>
      <Suspense
        fallback={<div className="h-44 animate-pulse rounded-xl bg-muted" />}
      >
        <CashOutlook />
      </Suspense>
      <Suspense fallback={null}>
        <DetailedSections />
      </Suspense>
      <Suspense fallback={null}>
        <Goals />
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

/** Asks once how the user wants to use the app. */
async function Welcome() {
  const profile = await getProfile();
  return profile.uiMode ? null : <WelcomeMode />;
}

/** What can be spent until payday and the payments coming up. */
async function CashOutlook() {
  // The forecast starts from today's date.
  await connection();
  const [forecast, t] = await Promise.all([
    getCashForecast(),
    getTranslations("CashFlow"),
  ]);
  return (
    <>
      <SafeToSpend forecast={forecast} detailsLink />
      {forecast.spendable.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("upcoming")}</h2>
            <Link
              href="/cashflow"
              className="text-sm font-medium text-primary hover:underline"
            >
              {t("calendar")}
            </Link>
          </div>
          <Card>
            <CashTimeline forecast={forecast} limit={5} />
          </Card>
        </section>
      )}
      <Suspense fallback={null}>
        <ResilienceTile />
      </Suspense>
    </>
  );
}

/** One line on how long the money would last without income. */
async function ResilienceTile() {
  const [r, locale, t] = await Promise.all([
    getResilience(),
    getLocale(),
    getTranslations("Resilience"),
  ]);
  if (r.months === null) return null;
  const months = t("months", {
    value: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
      r.months,
    ),
  });
  return (
    <Link
      href="/resilience"
      className="mt-4 flex items-center gap-3 rounded-xl border bg-card px-5 py-4 transition-colors hover:bg-muted/60"
    >
      <ShieldCheck className="size-5 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 text-sm">
        <span className="font-medium">{t("tile", { months })}</span>
        <span className="text-muted-foreground">
          {" "}
          · {t(`levels.${r.level}`)}
        </span>
      </span>
      <ArrowRight className="size-4 text-muted-foreground" />
    </Link>
  );
}

/**
 * Starts every query the sections below need at once, instead of each
 * section waiting for the ones before it (the results are cached per request).
 */
async function Preload() {
  await connection();
  const day = today();
  const month = monthRange(day);
  void Promise.allSettled([
    getAccounts(),
    getCashForecast(),
    getResilience(),
    getTotals(month.from, month.to),
    getRates(),
    getNetWorthHistory(
      periodRange("12m", day).from,
      periodRange("12m", day).to,
    ),
    getCategoryBreakdown(
      "expense",
      periodRange("thisMonth", day).from,
      periodRange("thisMonth", day).to,
    ),
    getCashFlow(periodRange("6m", day).from, periodRange("6m", day).to),
    getCategories(),
    getBudgetOverview(monthOf(day)),
    getGoals(),
  ]);
  return null;
}

/** Totals, budget alerts and charts, for the detailed interface only. */
async function DetailedSections() {
  const profile = await getProfile();
  if (uiModeOf(profile) !== "detailed") return null;
  return (
    <>
      <section className="mt-8">
        <Suspense
          fallback={<div className="h-28 animate-pulse rounded-xl bg-muted" />}
        >
          <Summary />
        </Suspense>
      </section>
      <Suspense fallback={null}>
        <BudgetAlerts />
      </Suspense>
      <Suspense fallback={null}>
        <Insights />
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
  const year = periodRange("12m", today());
  const [profile, accounts, totals, rateInfo, history, locale, t] =
    await Promise.all([
      getProfile(),
      getAccounts(),
      getTotals(from, to),
      getRates(),
      getNetWorthHistory(year.from, year.to),
      getLocale(),
      getTranslations("Dashboard"),
    ]);
  const currency = isCurrencyCode(profile.baseCurrency)
    ? profile.baseCurrency
    : DEFAULT_CURRENCY;
  const active = accounts.filter((a) => !a.archivedAt);

  // The cash flow card above already invites the user to add an account.
  if (active.length === 0) return null;

  // Everything is converted to the main currency at the latest TCMB rates.
  const { rates } = rateInfo;
  const code = (c: string) => (isCurrencyCode(c) ? c : DEFAULT_CURRENCY);
  const netWorth = sumIn(
    active.map((a) => ({ amount: a.balance, currency: code(a.currency) })),
    currency,
    rates,
  );
  const sumKind = (kind: string) =>
    sumIn(
      totals
        .filter((row) => row.kind === kind)
        .map((row) => ({ amount: row.total, currency: code(row.currency) })),
      currency,
      rates,
    );
  const income = sumKind("income");
  const expense = sumKind("expense");
  const foreign =
    active.some((a) => a.currency !== currency) ||
    totals.some((row) => row.currency !== currency);
  const missing = [netWorth, income, expense].some((s) => s.missing.length > 0);

  const cards = [
    { key: "netWorth", value: netWorth.total, kind: undefined },
    { key: "income", value: income.total, kind: "income" },
    { key: "expense", value: expense.total, kind: "expense" },
  ] as const;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.key}>
            <CardHeader>
              <CardDescription>{t(card.key)}</CardDescription>
              <div className="flex items-end justify-between gap-3">
                <Amount
                  value={card.value}
                  currency={currency}
                  locale={locale}
                  kind={card.kind}
                  className="text-2xl font-semibold"
                />
                {card.key === "netWorth" && (
                  <Sparkline
                    values={history.points.map((p) => p.value)}
                    label={t("netWorthTrend")}
                    width={88}
                  />
                )}
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
      {foreign && <RatesNote info={rateInfo} missing={missing} />}
    </>
  );
}

/** This month's biggest spending categories and the last six months. */
async function Insights() {
  await connection();
  const day = today();
  const month = periodRange("thisMonth", day);
  const half = periodRange("6m", day);
  const [breakdown, flow, categories, locale, t, tReports, tCategories] =
    await Promise.all([
      getCategoryBreakdown("expense", month.from, month.to),
      getCashFlow(half.from, half.to),
      getCategories(),
      getLocale(),
      getTranslations("Dashboard"),
      getTranslations("Reports"),
      getTranslations("Categories"),
    ]);
  if (flow.totals.income === 0 && flow.totals.expense === 0) return null;
  const top = breakdown.shares.slice(0, 5);
  const largest = top[0]?.total ?? 0;
  const nameOf = (id: string | null) => {
    const category = id ? categories.find((c) => c.id === id) : undefined;
    return category
      ? categoryName(category, tCategories)
      : tReports("uncategorized");
  };
  return (
    <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t("spendingThisMonth")}</h2>
          <Link
            href={{ pathname: "/reports", query: { period: "thisMonth" } }}
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("seeReports")}
          </Link>
        </div>
        {top.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tReports("noData")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {top.map((group) => (
              <li
                key={group.categoryId ?? "none"}
                className="flex flex-col gap-1"
              >
                <span className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{nameOf(group.categoryId)}</span>
                  <Amount
                    value={group.total}
                    currency={breakdown.currency}
                    locale={locale}
                    className="font-medium"
                  />
                </span>
                <span className="h-1.5 rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-chart-expense"
                    style={{ width: `${(group.total / largest) * 100}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="flex flex-col gap-2 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t("lastSixMonths")}</h2>
          <Link
            href="/reports"
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("seeReports")}
          </Link>
        </div>
        <CashFlowChart
          rows={flow.rows}
          granularity={flow.granularity}
          currency={flow.currency}
          height={190}
          labels={{
            income: tReports("income"),
            expense: tReports("expense"),
            net: tReports("net"),
            chart: tReports("cashFlowChart"),
          }}
        />
      </Card>
    </section>
  );
}

/** Budgets of this month that are close to or over their limit. */
async function BudgetAlerts() {
  await connection();
  const month = monthOf(today());
  const [{ lines }, categories, locale, t, tCategories] = await Promise.all([
    getBudgetOverview(month),
    getCategories(),
    getLocale(),
    getTranslations("Budgets"),
    getTranslations("Categories"),
  ]);
  const alerts = lines
    .filter((line) => line.status !== "ok")
    .sort((a, b) => b.spent / b.amount - a.spent / a.amount);
  if (alerts.length === 0) return null;
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("alerts")}</h2>
        <Link
          href="/budgets"
          className="text-sm font-medium text-primary hover:underline"
        >
          {t("title")}
        </Link>
      </div>
      <Card className="divide-y">
        {alerts.map((line) => {
          const label = categoryPath(line.category, categories, tCategories);
          return (
            <Link
              key={line.category.id}
              href={`/budgets/${line.category.id}`}
              className="flex flex-col gap-2 px-5 py-3 first:rounded-t-xl last:rounded-b-xl hover:bg-muted/60"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate font-medium">{label}</p>
                <p
                  className={cn(
                    "text-sm whitespace-nowrap",
                    line.status === "over"
                      ? "text-destructive"
                      : "text-warning-foreground",
                  )}
                >
                  {line.status === "over"
                    ? t("statusOver")
                    : t("statusWarning")}
                </p>
              </div>
              <Progress
                value={(line.spent / line.amount) * 100}
                label={label}
                tone={line.status === "over" ? "danger" : "warning"}
              />
              <p className="text-xs text-muted-foreground tabular-nums">
                <Amount
                  value={line.spent}
                  currency={line.currency}
                  locale={locale}
                />
                {" / "}
                <Amount
                  value={line.amount}
                  currency={line.currency}
                  locale={locale}
                />
              </p>
            </Link>
          );
        })}
      </Card>
    </section>
  );
}

/** Active savings goals that are not reached yet. */
async function Goals() {
  await connection();
  const [goals, t] = await Promise.all([
    getGoals(),
    getTranslations("Dashboard"),
  ]);
  const open = goals.filter((g) => !g.archivedAt && !g.progress.reached);
  if (open.length === 0) return null;
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("goals")}</h2>
        <Link
          href="/goals"
          className="text-sm font-medium text-primary hover:underline"
        >
          {t("seeAll")}
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {open.slice(0, 4).map((goal) => (
          <Link
            key={goal.id}
            href={`/goals/${goal.id}`}
            className="block rounded-xl border bg-card p-5 transition-colors hover:bg-muted/60"
          >
            <p className="mb-3 truncate font-medium">{goal.name}</p>
            <GoalSummary goal={goal} />
          </Link>
        ))}
      </div>
    </section>
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
