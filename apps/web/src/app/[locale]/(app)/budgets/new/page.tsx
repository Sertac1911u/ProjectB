import {
  budgetsInMonth,
  DEFAULT_CURRENCY,
  isCurrencyCode,
  monthOf,
} from "@projectb/core";
import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BudgetForm } from "@/components/finance/budget-form";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { getProfile } from "@/lib/auth";
import { categoryPath, categoryTree } from "@/lib/categories";
import { getCategories } from "@/lib/data/finance";
import { getBudgetVersions } from "@/lib/data/planning";
import { formatMonth, parseMonthParam, today } from "@/lib/dates";
import { isUuid } from "@/lib/ids";

type SearchParams = PageProps<"/[locale]/budgets/new">["searchParams"];

export default async function NewBudgetPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const t = await getTranslations("Budgets");
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("newTitle")} />
      <Suspense
        fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}
      >
        <NewBudget searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewBudget({ searchParams }: { searchParams: SearchParams }) {
  const { month: param, category } = await searchParams;
  await connection();
  const month = parseMonthParam(param) ?? monthOf(today());
  const [categories, versions, profile, locale, t, tCategories] =
    await Promise.all([
      getCategories(),
      getBudgetVersions(),
      getProfile(),
      getLocale(),
      getTranslations("Budgets"),
      getTranslations("Categories"),
    ]);
  const budgeted = budgetsInMonth(versions, month);
  const options = categoryTree(categories, "expense")
    .flatMap((parent) => [parent, ...parent.children])
    .filter((c) => !budgeted.has(c.id))
    .map((c) => ({
      id: c.id,
      label: categoryPath(c, categories, tCategories),
    }));

  if (options.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        {t("noCategories")}
      </Card>
    );
  }
  return (
    <Card className="p-6">
      <BudgetForm
        month={month}
        monthLabel={formatMonth(month, locale)}
        currency={
          isCurrencyCode(profile.baseCurrency)
            ? profile.baseCurrency
            : DEFAULT_CURRENCY
        }
        options={options}
        defaultCategoryId={
          isUuid(category) && options.some((o) => o.id === category)
            ? category
            : undefined
        }
      />
    </Card>
  );
}
