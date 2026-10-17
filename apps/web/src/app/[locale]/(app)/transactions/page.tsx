import { parseMoney } from "@projectb/core";
import { ChevronLeft, ChevronRight, Plus, Receipt } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import {
  type FilterValues,
  TransactionFilters,
} from "@/components/finance/transaction-filters";
import { TransactionList } from "@/components/finance/transaction-list";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import {
  getAccounts,
  getCategories,
  getTags,
  listTransactions,
  type TransactionFilters as Filters,
} from "@/lib/data/finance";
import { isUuid } from "@/lib/ids";

type SearchParams = PageProps<"/[locale]/transactions">["searchParams"];

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [t, tNav] = await Promise.all([
    getTranslations("Transactions"),
    getTranslations("Nav"),
  ]);
  return (
    <>
      <PageHeader
        title={tNav("transactions")}
        actions={
          <Link href="/transactions/new" className={buttonVariants()}>
            <Plus />
            {t("new")}
          </Link>
        }
      />
      <Suspense
        fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}
      >
        <Transactions searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function Transactions({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const read = (key: keyof FilterValues) => {
    const value = params[key];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  };
  const values: FilterValues = {
    q: read("q"),
    kind: read("kind"),
    account: read("account"),
    category: read("category"),
    tag: read("tag"),
    from: read("from"),
    to: read("to"),
    min: read("min"),
    max: read("max"),
  };
  const page = Math.max(
    1,
    Number.parseInt(String(params.page ?? "1"), 10) || 1,
  );

  const locale = await getLocale();
  // Invalid filter values are ignored rather than reported.
  const amount = (text?: string) => {
    const parsed = text ? parseMoney(text, "TRY", locale) : null;
    return parsed === null ? undefined : Math.abs(parsed);
  };
  const filters: Filters = {
    q: values.q?.slice(0, 100),
    kind: ["income", "expense", "transfer"].includes(values.kind ?? "")
      ? values.kind
      : undefined,
    accountId: isUuid(values.account) ? values.account : undefined,
    categoryId: isUuid(values.category) ? values.category : undefined,
    tagId: isUuid(values.tag) ? values.tag : undefined,
    from: values.from && DATE.test(values.from) ? values.from : undefined,
    to: values.to && DATE.test(values.to) ? values.to : undefined,
    minAmount: amount(values.min),
    maxAmount: amount(values.max),
  };
  // All queries in parallel: each one is a round trip to the database.
  const [t, accounts, categories, tags, { rows, hasMore }] = await Promise.all([
    getTranslations("Transactions"),
    getAccounts(),
    getCategories(),
    getTags(),
    listTransactions(filters, page),
  ]);
  const filtered = Object.values(values).some(Boolean);

  const pageLink = (target: number) => ({
    pathname: "/transactions" as const,
    query: {
      ...Object.fromEntries(Object.entries(values).filter(([, v]) => v)),
      page: target,
    },
  });

  return (
    <>
      {(rows.length > 0 || filtered || page > 1) && (
        <TransactionFilters
          values={values}
          accounts={accounts}
          categories={categories}
          tags={tags}
        />
      )}
      {rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Receipt className="size-5" />
          </span>
          {filtered || page > 1 ? (
            <p className="font-medium">{t("noResults")}</p>
          ) : accounts.length === 0 ? (
            <>
              <p className="max-w-sm text-sm text-muted-foreground">
                {t("needAccount")}
              </p>
              <Link
                href="/accounts/new"
                className={buttonVariants({ className: "mt-2" })}
              >
                <Plus />
                {(await getTranslations("Accounts"))("addFirst")}
              </Link>
            </>
          ) : (
            <>
              <p className="font-medium">{t("emptyTitle")}</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {t("emptyDescription")}
              </p>
              <Link
                href="/transactions/new"
                className={buttonVariants({ className: "mt-2" })}
              >
                <Plus />
                {t("new")}
              </Link>
            </>
          )}
        </Card>
      ) : (
        <TransactionList rows={rows} categories={categories} />
      )}
      {(page > 1 || hasMore) && (
        <nav className="mt-4 flex justify-between">
          {page > 1 ? (
            <Link
              href={pageLink(page - 1)}
              className={buttonVariants({ variant: "outline" })}
            >
              <ChevronLeft />
              {t("previous")}
            </Link>
          ) : (
            <span />
          )}
          {hasMore && (
            <Link
              href={pageLink(page + 1)}
              className={buttonVariants({ variant: "outline" })}
            >
              {t("next")}
              <ChevronRight />
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
