import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Plus,
  Repeat,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Amount } from "@/components/finance/amount";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { categoryName } from "@/lib/categories";
import { getAccounts, getCategories } from "@/lib/data/finance";
import { getRecurringRules } from "@/lib/data/recurring";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

const ICONS = {
  income: ArrowDownLeft,
  expense: ArrowUpRight,
  transfer: ArrowLeftRight,
};

export default async function RecurringPage() {
  const t = await getTranslations("Recurring");
  return (
    <div className="max-w-4xl">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Link href="/recurring/new" className={buttonVariants()}>
            <Plus />
            {t("new")}
          </Link>
        }
      />
      <Suspense
        fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}
      >
        <RuleList />
      </Suspense>
    </div>
  );
}

async function RuleList() {
  const [rules, accounts, categories, locale, t, tTransactions, tCategories] =
    await Promise.all([
      getRecurringRules(),
      getAccounts(),
      getCategories(),
      getLocale(),
      getTranslations("Recurring"),
      getTranslations("Transactions"),
      getTranslations("Categories"),
    ]);

  if (rules.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Repeat className="size-5" />
        </span>
        <p className="font-medium">{t("emptyTitle")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("emptyDescription")}
        </p>
        <Link
          href="/recurring/new"
          className={buttonVariants({ className: "mt-2" })}
        >
          <Plus />
          {t("new")}
        </Link>
      </Card>
    );
  }

  const accountName = (id: string | null) =>
    accounts.find((a) => a.id === id)?.name ?? "";
  const currencyOf = (id: string) =>
    accounts.find((a) => a.id === id)?.currency ?? "TRY";

  return (
    <Card className="divide-y">
      {rules.map((rule) => {
        const Icon = ICONS[rule.kind as keyof typeof ICONS] ?? ArrowUpRight;
        const category = categories.find((c) => c.id === rule.categoryId);
        const title =
          rule.note ||
          (rule.kind === "transfer"
            ? tTransactions("transferLabel", {
                from: accountName(rule.accountId),
                to: accountName(rule.toAccountId),
              })
            : category
              ? categoryName(category, tCategories)
              : tTransactions(`kinds.${rule.kind as "income" | "expense"}`));
        const status = rule.finished
          ? t("finished")
          : rule.paused
            ? t("paused")
            : t("next", { date: formatDay(rule.nextOn, locale) });
        const remaining =
          !rule.finished && rule.maxOccurrences
            ? t("remaining", { count: rule.maxOccurrences - rule.occurrences })
            : null;
        return (
          <Link
            key={rule.id}
            href={`/recurring/${rule.id}`}
            className={cn(
              "flex items-center gap-3 px-5 py-4 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-muted/60",
              (rule.finished || rule.paused) && "opacity-60",
            )}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{title}</p>
              <p className="truncate text-sm text-muted-foreground">
                {[
                  t(
                    `summary.${rule.frequency as "weekly" | "monthly" | "yearly"}`,
                    {
                      interval: rule.intervalCount,
                    },
                  ),
                  rule.kind !== "transfer" && accountName(rule.accountId),
                  status,
                  remaining,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <Amount
              value={rule.amount}
              currency={currencyOf(rule.accountId)}
              locale={locale}
              kind={rule.kind}
              className="font-medium"
            />
          </Link>
        );
      })}
    </Card>
  );
}
