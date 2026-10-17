import {
  addMonths,
  formatMoney,
  isCurrencyCode,
  monthOf,
} from "@projectb/core";
import { ChevronLeft, ChevronRight, PiggyBank, Plus } from "lucide-react";
import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Amount } from "@/components/finance/amount";
import { RatesNote } from "@/components/finance/rates-note";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import { categoryPath } from "@/lib/categories";
import { getCategories } from "@/lib/data/finance";
import { type BudgetLine, getBudgetOverview } from "@/lib/data/planning";
import {
  daysBetween,
  formatMonth,
  monthRange,
  parseMonthParam,
  today,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

type SearchParams = PageProps<"/[locale]/budgets">["searchParams"];

const TONE = { ok: "default", warning: "warning", over: "danger" } as const;

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const t = await getTranslations("Budgets");
  return (
    <div className="max-w-4xl">
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense
        fallback={<div className="h-80 animate-pulse rounded-xl bg-muted" />}
      >
        <Budgets searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Budgets({ searchParams }: { searchParams: SearchParams }) {
  const { month: param } = await searchParams;
  // The default month depends on today's date.
  await connection();
  const day = today();
  const current = monthOf(day);
  const month = parseMonthParam(param) ?? current;
  const [overview, categories, locale, t, tCategories] = await Promise.all([
    getBudgetOverview(month),
    getCategories(),
    getLocale(),
    getTranslations("Budgets"),
    getTranslations("Categories"),
  ]);
  const { lines, total, unbudgeted, baseCurrency, rateInfo } = overview;
  const isCurrent = month === current;
  // Days left in the month, today included.
  const daysLeft = isCurrent ? daysBetween(day, monthRange(month).to) + 1 : 0;
  const money = (
    value: number,
    currency = baseCurrency,
    className?: string,
  ) => (
    <Amount
      value={value}
      currency={currency}
      locale={locale}
      className={className}
    />
  );
  const monthHref = (m: string) => ({
    pathname: "/budgets",
    query: m === current ? {} : { month: m.slice(0, 7) },
  });
  const label = (line: BudgetLine) =>
    categoryPath(line.category, categories, tCategories);
  const hasChildren = (id: string) => categories.some((c) => c.parentId === id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link
            href={monthHref(addMonths(month, -1))}
            className={buttonVariants({ variant: "ghost", size: "icon" })}
            aria-label={t("previousMonth")}
          >
            <ChevronLeft />
          </Link>
          <h2 className="min-w-36 text-center text-lg font-semibold">
            {formatMonth(month, locale)}
          </h2>
          <Link
            href={monthHref(addMonths(month, 1))}
            className={buttonVariants({ variant: "ghost", size: "icon" })}
            aria-label={t("nextMonth")}
          >
            <ChevronRight />
          </Link>
          {!isCurrent && (
            <Link
              href={monthHref(current)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {t("thisMonth")}
            </Link>
          )}
        </div>
        <Link
          href={{
            pathname: "/budgets/new",
            query: { month: month.slice(0, 7) },
          }}
          className={buttonVariants()}
        >
          <Plus />
          {t("new")}
        </Link>
      </div>

      {lines.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <PiggyBank className="size-5" />
          </span>
          <p className="font-medium">{t("emptyTitle")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("emptyDescription")}
          </p>
        </Card>
      ) : (
        <>
          <Card className="flex flex-col gap-3 p-5">
            <dl className="grid grid-cols-3 gap-4">
              <div>
                <dt className="text-sm text-muted-foreground">{t("total")}</dt>
                <dd>
                  {money(total.amount, baseCurrency, "text-xl font-semibold")}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">{t("spent")}</dt>
                <dd>
                  {money(total.spent, baseCurrency, "text-xl font-semibold")}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">{t("left")}</dt>
                <dd>
                  {money(
                    total.amount - total.spent,
                    baseCurrency,
                    "text-xl font-semibold",
                  )}
                </dd>
              </div>
            </dl>
            <Progress
              value={total.amount ? (total.spent / total.amount) * 100 : 0}
              label={t("spent")}
              tone={
                total.spent > total.amount
                  ? "danger"
                  : total.spent >= total.amount * 0.8
                    ? "warning"
                    : "default"
              }
            />
            {total.missing && <RatesNote info={rateInfo} missing />}
          </Card>

          <Card className="divide-y">
            {lines.map((line) => {
              const left = line.amount - line.spent;
              return (
                <Link
                  key={line.category.id}
                  href={{
                    pathname: `/budgets/${line.category.id}`,
                    query: { month: month.slice(0, 7) },
                  }}
                  className="flex flex-col gap-2 px-5 py-4 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-muted/60"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{label(line)}</p>
                      <p className="text-xs text-muted-foreground">
                        {[
                          hasChildren(line.category.id) &&
                            t("includesSubcategories"),
                          line.insideParent &&
                            t("insideParent", {
                              parent: categoryPath(
                                categories.find(
                                  (c) => c.id === line.category.parentId,
                                )!,
                                categories,
                                tCategories,
                              ),
                            }),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <p className="text-sm tabular-nums">
                      {money(line.spent, line.currency, "font-medium")}
                      <span className="text-muted-foreground">
                        {" / "}
                        {money(line.amount, line.currency)}
                      </span>
                    </p>
                  </div>
                  <Progress
                    value={(line.spent / line.amount) * 100}
                    label={label(line)}
                    tone={TONE[line.status]}
                  />
                  <p
                    className={cn(
                      "text-xs",
                      line.status === "over"
                        ? "text-destructive"
                        : line.status === "warning"
                          ? "text-warning-foreground"
                          : "text-muted-foreground",
                    )}
                  >
                    {line.status === "over"
                      ? `${t("statusOver")} · ${t("overBy", {
                          amount: formatPlain(-left, line.currency, locale),
                        })}`
                      : [
                          line.status === "warning" && t("statusWarning"),
                          `${t("left")}: ${formatPlain(left, line.currency, locale)}`,
                          isCurrent &&
                            daysLeft > 0 &&
                            t("perDay", {
                              amount: formatPlain(
                                Math.floor(left / daysLeft),
                                line.currency,
                                locale,
                              ),
                            }),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                  </p>
                </Link>
              );
            })}
          </Card>
        </>
      )}

      {unbudgeted.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("unbudgeted")}</CardTitle>
            <CardDescription>{t("unbudgetedHint")}</CardDescription>
          </CardHeader>
          <ul className="divide-y border-t">
            {unbudgeted.map(({ category, spent }) => (
              <li
                key={category?.id ?? "none"}
                className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
              >
                <span className="min-w-0 truncate">
                  {category
                    ? categoryPath(category, categories, tCategories)
                    : t("uncategorized")}
                </span>
                <span className="flex items-center gap-3">
                  {money(spent)}
                  {category && (
                    <Link
                      href={{
                        pathname: "/budgets/new",
                        query: {
                          month: month.slice(0, 7),
                          category: category.id,
                        },
                      }}
                      className="font-medium text-primary hover:underline"
                    >
                      {t("addFor")}
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** Money as plain text, for use inside translated sentences. */
function formatPlain(value: number, currency: string, locale: string) {
  return formatMoney(
    value,
    isCurrencyCode(currency) ? currency : "TRY",
    locale,
  );
}
