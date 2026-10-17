import {
  budgetsInMonth,
  DEFAULT_CURRENCY,
  isCurrencyCode,
  type Locale,
  monthOf,
} from "@projectb/core";
import { ListFilter, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BudgetForm } from "@/components/finance/budget-form";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { Link, redirect } from "@/i18n/navigation";
import { removeBudget } from "@/lib/actions/planning";
import { categoryPath } from "@/lib/categories";
import { getCategories } from "@/lib/data/finance";
import { getBudgetVersions } from "@/lib/data/planning";
import { formatMonth, monthRange, parseMonthParam, today } from "@/lib/dates";
import { isUuid } from "@/lib/ids";

type Props = PageProps<"/[locale]/budgets/[categoryId]">;

export default async function EditBudgetPage({ params, searchParams }: Props) {
  const t = await getTranslations("Budgets");
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("editTitle")} />
      <Suspense
        fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}
      >
        <EditBudget params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function EditBudget({
  params,
  searchParams,
}: Pick<Props, "params" | "searchParams">) {
  const [{ categoryId }, { month: param }] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!isUuid(categoryId)) notFound();
  await connection();
  const month = parseMonthParam(param) ?? monthOf(today());
  const [categories, versions, locale, t, tCategories] = await Promise.all([
    getCategories(),
    getBudgetVersions(),
    getLocale() as Promise<Locale>,
    getTranslations("Budgets"),
    getTranslations("Categories"),
  ]);
  const category = categories.find((c) => c.id === categoryId);
  if (!category || category.kind !== "expense") notFound();
  const budget = budgetsInMonth(versions, month).get(categoryId);
  if (!budget) {
    return redirect({
      href: {
        pathname: "/budgets/new",
        query: { month: month.slice(0, 7), category: categoryId },
      },
      locale,
    });
  }
  const label = categoryPath(category, categories, tCategories);
  const monthLabel = formatMonth(month, locale);
  // An edited limit keeps its currency, even if the main currency changed.
  const currency = isCurrencyCode(budget.currency)
    ? budget.currency
    : DEFAULT_CURRENCY;
  const { from, to } = monthRange(month);

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-6">
        <BudgetForm
          month={month}
          monthLabel={monthLabel}
          currency={currency}
          options={[{ id: category.id, label }]}
          budget={{ categoryId: category.id, amount: budget.amount }}
        />
      </Card>
      <Card className="flex flex-col gap-3 p-6">
        <div className="flex flex-wrap gap-2">
          <Link
            href={{
              pathname: "/transactions",
              query: { category: category.id, from, to },
            }}
            className={buttonVariants({ variant: "outline" })}
          >
            <ListFilter />
            {t("seeTransactions")}
          </Link>
          <form action={removeBudget.bind(null, locale, category.id, month)}>
            <SubmitButton variant="destructive">
              <Trash2 />
              {t("remove")}
            </SubmitButton>
          </form>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("removeHint", { month: monthLabel })}
        </p>
      </Card>
    </div>
  );
}
