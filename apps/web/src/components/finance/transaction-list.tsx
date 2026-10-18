import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Repeat,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Amount } from "@/components/finance/amount";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { categoryName } from "@/lib/categories";
import type { CategoryRow, TransactionListRow } from "@/lib/data/finance";
import { formatDay } from "@/lib/dates";

const ICONS = {
  income: ArrowDownLeft,
  expense: ArrowUpRight,
  transfer: ArrowLeftRight,
};

export async function TransactionList({
  rows,
  categories,
}: {
  rows: TransactionListRow[];
  categories: CategoryRow[];
}) {
  const [locale, t, tCategories, tRecurring] = await Promise.all([
    getLocale(),
    getTranslations("Transactions"),
    getTranslations("Categories"),
    getTranslations("Recurring"),
  ]);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const label = (id: string | null) => {
    const category = id ? byId.get(id) : undefined;
    if (!category) return t("noCategory");
    const parent = category.parentId ? byId.get(category.parentId) : undefined;
    const name = categoryName(category, tCategories);
    return parent ? `${categoryName(parent, tCategories)} › ${name}` : name;
  };

  const days = Map.groupBy(rows, (row) => row.occurredOn);

  return (
    // One card, with a quiet heading row for each day.
    <Card className="overflow-hidden">
      {[...days].map(([day, items]) => (
        <section key={day} className="border-t first:border-t-0">
          <h2 className="bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground sm:px-5">
            {formatDay(day, locale)}
          </h2>
          <div className="divide-y border-t">
            {items.map((row) => {
              const Icon =
                ICONS[row.kind as keyof typeof ICONS] ?? ArrowUpRight;
              const title =
                row.kind === "transfer"
                  ? t("transferLabel", {
                      from: row.account.name,
                      to: row.toAccount?.name ?? "",
                    })
                  : label(row.categoryId);
              return (
                <Link
                  key={row.id}
                  href={`/transactions/${row.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 sm:px-5"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{title}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {[row.kind !== "transfer" && row.account.name, row.note]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {(row.tags.length > 0 ||
                      row.installmentCount > 1 ||
                      row.recurringRuleId) && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {row.recurringRuleId && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                            <Repeat className="size-3" />
                            {tRecurring("badge")}
                          </span>
                        )}
                        {row.installmentCount > 1 && (
                          <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                            {t("installmentBadge", {
                              count: row.installmentCount,
                            })}
                          </span>
                        )}
                        {row.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <Amount
                      value={row.amount}
                      currency={row.account.currency}
                      locale={locale}
                      kind={row.kind}
                      className="font-medium"
                    />
                    {row.kind === "transfer" &&
                      row.toAccount &&
                      row.toAccount.currency !== row.account.currency &&
                      row.toAmount !== null && (
                        <p className="text-xs text-muted-foreground">
                          <Amount
                            value={row.toAmount}
                            currency={row.toAccount.currency}
                            locale={locale}
                          />
                        </p>
                      )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </Card>
  );
}
