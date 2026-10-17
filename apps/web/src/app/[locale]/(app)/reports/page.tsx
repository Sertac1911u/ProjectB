import {
  changePercent,
  type CurrencyCode,
  formatMoney,
  isReportPeriod,
  periodRange,
  previousRange,
  REPORT_PERIODS,
  type ReportPeriod,
  share,
} from "@projectb/core";
import { ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { LineChart } from "@/components/charts/line-chart";
import { bucketTitle } from "@/components/charts/scale";
import { RatesNote } from "@/components/finance/rates-note";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { categoryName } from "@/lib/categories";
import { getAccounts, getCategories } from "@/lib/data/finance";
import {
  getCashFlow,
  getCategoryBreakdown,
  getNetWorthHistory,
} from "@/lib/data/reports";
import { today } from "@/lib/dates";
import { cn } from "@/lib/utils";

type SearchParams = PageProps<"/[locale]/reports">["searchParams"];

const DEFAULT_PERIOD: ReportPeriod = "6m";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const t = await getTranslations("Reports");
  return (
    <div className="max-w-5xl">
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense
        fallback={
          <div className="h-[40rem] animate-pulse rounded-xl bg-muted" />
        }
      >
        <Reports searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Reports({ searchParams }: { searchParams: SearchParams }) {
  const { period: periodParam, kind: kindParam } = await searchParams;
  // Periods are relative to today.
  await connection();
  const period = isReportPeriod(periodParam) ? periodParam : DEFAULT_PERIOD;
  const kind = kindParam === "income" ? "income" : "expense";
  const { from, to } = periodRange(period, today());
  const previous = previousRange(from, to);
  const [
    flow,
    before,
    breakdown,
    netWorth,
    categories,
    accounts,
    locale,
    t,
    tCategories,
  ] = await Promise.all([
    getCashFlow(from, to),
    getCashFlow(previous.from, previous.to),
    getCategoryBreakdown(kind, from, to),
    getNetWorthHistory(from, to),
    getCategories(),
    getAccounts(),
    getLocale(),
    getTranslations("Reports"),
    getTranslations("Categories"),
  ]);
  const { currency } = flow;
  const money = (v: number) => formatMoney(v, currency, locale);
  const percent = (v: number) => formatPercent(v, locale);
  // Links keep the other choice and leave defaults out of the address.
  const query = (changes: { period?: ReportPeriod; kind?: string }) => {
    const next = { period, kind, ...changes };
    return {
      pathname: "/reports",
      query: {
        ...(next.period !== DEFAULT_PERIOD ? { period: next.period } : {}),
        ...(next.kind === "income" ? { kind: "income" } : {}),
      },
    };
  };

  const net = flow.totals.income - flow.totals.expense;
  const netBefore = before.totals.income - before.totals.expense;
  const rate =
    flow.totals.income > 0 ? Math.round(share(net, flow.totals.income)) : null;
  const tiles = [
    {
      key: "income",
      value: money(flow.totals.income),
      change: changePercent(flow.totals.income, before.totals.income),
      upIsGood: true,
    },
    {
      key: "expense",
      value: money(flow.totals.expense),
      change: changePercent(flow.totals.expense, before.totals.expense),
      upIsGood: false,
    },
    {
      key: "net",
      value: money(net),
      change: changePercent(net, netBefore),
      upIsGood: true,
    },
    {
      key: "savingsRate",
      value: rate === null ? "—" : percent(rate),
      hint: t("savingsRateHint"),
      upIsGood: true,
    },
  ] as const;

  const nameOf = (id: string | null) => {
    const category = id ? categories.find((c) => c.id === id) : undefined;
    return category ? categoryName(category, tCategories) : t("uncategorized");
  };
  const largest = breakdown.shares[0]?.total ?? 0;
  const barColor =
    kind === "income" ? "var(--chart-income)" : "var(--chart-expense)";
  const missing = flow.missing || breakdown.missing || netWorth.missing;
  const hasForeign = missing || accounts.some((a) => a.currency !== currency);

  return (
    <div className="flex flex-col gap-4">
      <nav
        aria-label={t("period")}
        className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0"
      >
        {REPORT_PERIODS.map((p) => (
          <Link
            key={p}
            href={query({ period: p })}
            aria-current={p === period ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              p === period
                ? "border-primary bg-accent text-accent-foreground"
                : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t(`periods.${p}`)}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.key} className="flex flex-col gap-1 p-5">
            <p className="text-sm text-muted-foreground">{t(tile.key)}</p>
            <p className="text-xl font-semibold whitespace-nowrap">
              {tile.value}
            </p>
            {"change" in tile ? (
              <Delta
                locale={locale}
                change={tile.change}
                upIsGood={tile.upIsGood}
                label={(change) => t("vsPrevious", { change })}
                empty={t("noPrevious")}
              />
            ) : (
              <p className="text-xs text-muted-foreground">{tile.hint}</p>
            )}
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("cashFlow")}</CardTitle>
          <CardDescription>
            {t("cashFlowHint", { granularity: flow.granularity })}
          </CardDescription>
        </CardHeader>
        <div className="px-5 pb-5">
          <CashFlowChart
            rows={flow.rows}
            granularity={flow.granularity}
            currency={currency}
            labels={{
              income: t("income"),
              expense: t("expense"),
              net: t("net"),
              chart: t("cashFlowChart"),
            }}
          />
          <DataTable
            label={t("showTable")}
            headers={[t("date"), t("income"), t("expense"), t("net")]}
            rows={flow.rows.map((r) => [
              bucketTitle(r.start, flow.granularity, locale),
              money(r.income),
              money(r.expense),
              money(r.income - r.expense),
            ])}
          />
        </div>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>
            {kind === "income" ? t("incomeByCategory") : t("expenseByCategory")}
          </CardTitle>
          <div className="flex rounded-md border p-0.5 text-sm">
            {(["expense", "income"] as const).map((k) => (
              <Link
                key={k}
                href={query({ kind: k })}
                aria-current={k === kind ? "page" : undefined}
                className={cn(
                  "rounded px-3 py-1 font-medium",
                  k === kind
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(k)}
              </Link>
            ))}
          </div>
        </CardHeader>
        {breakdown.shares.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">
            {t("noData")}
          </p>
        ) : (
          <ul className="flex flex-col gap-4 px-5 pb-5">
            {breakdown.shares.map((group) => (
              <li key={group.categoryId ?? "none"}>
                <details className="group">
                  <summary
                    className={cn(
                      "flex cursor-pointer list-none flex-col gap-1.5",
                      group.children.length === 0 && "cursor-default",
                    )}
                  >
                    <span className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-1 font-medium">
                        {group.children.length > 0 && (
                          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                        )}
                        <span className="truncate">
                          {nameOf(group.categoryId)}
                        </span>
                      </span>
                      <span className="flex shrink-0 gap-3 tabular-nums">
                        <span className="w-12 text-right text-muted-foreground">
                          {percent(share(group.total, breakdown.total))}
                        </span>
                        <span className="w-28 text-right font-medium">
                          {money(group.total)}
                        </span>
                      </span>
                    </span>
                    <span className="h-2 rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${share(group.total, largest)}%`,
                          background: barColor,
                        }}
                      />
                    </span>
                  </summary>
                  {group.children.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1 border-l pl-4 text-sm">
                      {group.children.map((child) => (
                        <li
                          key={child.categoryId}
                          className="flex justify-between gap-3 text-muted-foreground"
                        >
                          <span className="truncate">
                            {nameOf(child.categoryId)}
                          </span>
                          <span className="tabular-nums">
                            {money(child.total)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
                {group.categoryId && (
                  <Link
                    href={{
                      pathname: "/transactions",
                      query: { category: group.categoryId, kind, from, to },
                    }}
                    className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
                  >
                    {t("seeTransactions")}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("netWorth")}</CardTitle>
          <CardDescription>{t("netWorthHint")}</CardDescription>
        </CardHeader>
        <div className="px-5 pb-5">
          {netWorth.points.some((p) => p.value !== null) ? (
            <>
              <LineChart
                points={netWorth.points}
                granularity={netWorth.granularity}
                currency={netWorth.currency}
                label={t("netWorthChart")}
              />
              <DataTable
                label={t("showTable")}
                headers={[t("date"), t("netWorth")]}
                rows={netWorth.points
                  .filter((p) => p.value !== null)
                  .map((p) => [
                    bucketTitle(p.at, "day", locale),
                    formatMoney(
                      p.value!,
                      netWorth.currency as CurrencyCode,
                      locale,
                    ),
                  ])}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noData")}</p>
          )}
        </div>
      </Card>
      {hasForeign && <RatesNote info={flow.rateInfo} missing={missing} />}
    </div>
  );
}

function Delta({
  locale,
  change,
  upIsGood,
  label,
  empty,
}: {
  locale: string;
  change: number | null;
  upIsGood: boolean;
  label: (change: string) => string;
  empty: string;
}) {
  if (change === null || !Number.isFinite(change)) {
    return <p className="text-xs text-muted-foreground">{empty}</p>;
  }
  const rounded = Math.round(change);
  const good = rounded === 0 ? null : rounded > 0 === upIsGood;
  const Icon = rounded >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <p
      className={cn(
        "flex items-center gap-1 text-xs",
        good === null
          ? "text-muted-foreground"
          : good
            ? "text-accent-foreground"
            : "text-destructive",
      )}
    >
      <Icon className="size-3.5" />
      {label(`${rounded > 0 ? "+" : ""}${formatPercent(rounded, locale)}`)}
    </p>
  );
}

/** 57 -> "%57" in Turkish, "57%" in English. */
function formatPercent(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function DataTable({
  label,
  headers,
  rows,
}: {
  label: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer text-xs font-medium text-primary">
        {label}
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-xs text-muted-foreground">
            <tr>
              {headers.map((h, i) => (
                <th
                  key={h}
                  className={cn("py-1.5 font-medium", i > 0 && "text-right")}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y tabular-nums">
            {rows.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, i) => (
                  <td key={i} className={cn("py-1.5", i > 0 && "text-right")}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
