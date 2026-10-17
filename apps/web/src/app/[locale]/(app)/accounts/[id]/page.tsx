import { isAccountType } from "@projectb/core";
import { Pencil, Plus } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AccountIcon } from "@/components/finance/account-icon";
import { Amount } from "@/components/finance/amount";
import { CardOverview } from "@/components/finance/card-overview";
import { TransactionList } from "@/components/finance/transaction-list";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { isConfiguredCard } from "@/lib/data/cards";
import {
  getAccount,
  getCategories,
  listTransactions,
} from "@/lib/data/finance";
import { isUuid } from "@/lib/ids";

type Props = PageProps<"/[locale]/accounts/[id]">;

export default function AccountPage({ params, searchParams }: Props) {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}
    >
      <AccountOverview params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function AccountOverview({
  params,
  searchParams,
}: Pick<Props, "params" | "searchParams">) {
  const [{ id }, { statement }] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const [account, locale, t, tTypes, tCard, tTransactions] = await Promise.all([
    getAccount(id),
    getLocale(),
    getTranslations("Accounts"),
    getTranslations("AccountTypes"),
    getTranslations("Card"),
    getTranslations("Transactions"),
  ]);
  if (!account) notFound();
  const isCard = account.type === "credit_card";

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AccountIcon type={account.type} className="size-11" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {account.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {tTypes(isAccountType(account.type) ? account.type : "bank")}
              {account.archivedAt && ` · ${t("archivedBadge")}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={{
              pathname: "/transactions/new",
              query: { account: account.id },
            }}
            className={buttonVariants()}
          >
            <Plus />
            {tTransactions("new")}
          </Link>
          <Link
            href={`/accounts/${account.id}/edit`}
            className={buttonVariants({ variant: "outline" })}
          >
            <Pencil />
            {t("edit")}
          </Link>
        </div>
      </div>

      {!isCard && (
        <Card className="mb-4 p-5">
          <p className="text-sm text-muted-foreground">{t("balance")}</p>
          <Amount
            value={account.balance}
            currency={account.currency}
            locale={locale}
            className="text-2xl font-semibold"
          />
        </Card>
      )}

      {isCard &&
        (isConfiguredCard(account) ? (
          <CardOverview
            card={account}
            statementDate={
              typeof statement === "string" ? statement : undefined
            }
          />
        ) : (
          <Card className="flex flex-col items-start gap-2 p-5">
            <p className="font-medium">{tCard("setupTitle")}</p>
            <p className="text-sm text-muted-foreground">
              {tCard("setupDescription")}
            </p>
            <Link
              href={`/accounts/${account.id}/edit`}
              className={buttonVariants({ className: "mt-2" })}
            >
              {tCard("setup")}
            </Link>
          </Card>
        ))}

      {!isCard && <RecentTransactions accountId={account.id} />}
    </div>
  );
}

async function RecentTransactions({ accountId }: { accountId: string }) {
  const [{ rows }, categories, t, tDashboard] = await Promise.all([
    listTransactions({ accountId }, 1),
    getCategories(),
    getTranslations("Accounts"),
    getTranslations("Dashboard"),
  ]);
  if (rows.length === 0) return null;
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("recent")}</h2>
        <Link
          href={{ pathname: "/transactions", query: { account: accountId } }}
          className="text-sm font-medium text-primary hover:underline"
        >
          {tDashboard("seeAll")}
        </Link>
      </div>
      <TransactionList rows={rows.slice(0, 10)} categories={categories} />
    </section>
  );
}
