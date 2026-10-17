import { isAccountType } from "@projectb/core";
import { Plus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AccountIcon } from "@/components/finance/account-icon";
import { Amount } from "@/components/finance/amount";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { type AccountWithBalance, getAccounts } from "@/lib/data/finance";

export default async function AccountsPage() {
  const [t, tNav] = await Promise.all([
    getTranslations("Accounts"),
    getTranslations("Nav"),
  ]);
  return (
    <>
      <PageHeader
        title={tNav("accounts")}
        actions={
          <Link href="/accounts/new" className={buttonVariants()}>
            <Plus />
            {t("new")}
          </Link>
        }
      />
      <Suspense fallback={<ListSkeleton />}>
        <AccountList />
      </Suspense>
    </>
  );
}

function ListSkeleton() {
  return <div className="h-48 animate-pulse rounded-xl bg-muted" />;
}

async function AccountList() {
  const [accounts, t, tTypes, locale] = await Promise.all([
    getAccounts(),
    getTranslations("Accounts"),
    getTranslations("AccountTypes"),
    getLocale(),
  ]);
  const active = accounts.filter((a) => !a.archivedAt);
  const archived = accounts.filter((a) => a.archivedAt);

  if (accounts.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <AccountIcon type="bank" className="size-12 rounded-full" />
        <p className="font-medium">{t("emptyTitle")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("emptyDescription")}
        </p>
        <Link
          href="/accounts/new"
          className={buttonVariants({ className: "mt-2" })}
        >
          <Plus />
          {t("addFirst")}
        </Link>
      </Card>
    );
  }

  const totals = Object.entries(
    active.reduce<Record<string, number>>((sum, a) => {
      sum[a.currency] = (sum[a.currency] ?? 0) + a.balance;
      return sum;
    }, {}),
  );

  return (
    <div className="flex flex-col gap-4">
      {totals.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {totals.map(([currency, total]) => (
            <Card key={currency} className="p-5">
              <p className="text-sm text-muted-foreground">
                {t("total", { currency })}
              </p>
              <Amount
                value={total}
                currency={currency}
                locale={locale}
                className="text-2xl font-semibold"
              />
            </Card>
          ))}
        </div>
      )}
      <Card className="divide-y">
        {active.map((account) => (
          <AccountRow
            key={account.id}
            account={account}
            typeLabel={tTypes(
              isAccountType(account.type) ? account.type : "bank",
            )}
            locale={locale}
          />
        ))}
      </Card>
      {archived.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            {t("archived")} ({archived.length})
          </summary>
          <Card className="mt-3 divide-y opacity-75">
            {archived.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                typeLabel={tTypes(
                  isAccountType(account.type) ? account.type : "bank",
                )}
                locale={locale}
              />
            ))}
          </Card>
        </details>
      )}
    </div>
  );
}

function AccountRow({
  account,
  typeLabel,
  locale,
}: {
  account: AccountWithBalance;
  typeLabel: string;
  locale: string;
}) {
  return (
    <Link
      href={`/accounts/${account.id}`}
      className="flex items-center gap-3 px-5 py-4 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-muted/60"
    >
      <AccountIcon type={account.type} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{account.name}</p>
        <p className="text-sm text-muted-foreground">{typeLabel}</p>
      </div>
      <Amount
        value={account.balance}
        currency={account.currency}
        locale={locale}
        className="font-medium"
      />
    </Link>
  );
}
