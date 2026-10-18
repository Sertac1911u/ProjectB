import {
  convert,
  DEFAULT_CURRENCY,
  isAccountType,
  isCurrencyCode,
  sumIn,
} from "@projectb/core";
import { Plus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AccountIcon } from "@/components/finance/account-icon";
import { Amount } from "@/components/finance/amount";
import { RatesNote } from "@/components/finance/rates-note";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { getProfile } from "@/lib/auth";
import { type AccountWithBalance, getAccounts } from "@/lib/data/finance";
import { getRates } from "@/lib/data/rates";

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
  const [accounts, profile, rateInfo, t, tTypes, locale] = await Promise.all([
    getAccounts(),
    getProfile(),
    getRates(),
    getTranslations("Accounts"),
    getTranslations("AccountTypes"),
    getLocale(),
  ]);
  const base = isCurrencyCode(profile.baseCurrency)
    ? profile.baseCurrency
    : DEFAULT_CURRENCY;
  const code = (c: string) => (isCurrencyCode(c) ? c : DEFAULT_CURRENCY);
  /** The account balance in the main currency, for accounts in other currencies. */
  const inBase = (account: AccountWithBalance) =>
    account.currency === base
      ? null
      : convert(account.balance, code(account.currency), base, rateInfo.rates);
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
  const multiCurrency =
    totals.length > 1 || (totals[0] && totals[0][0] !== base);
  const overall = sumIn(
    active.map((a) => ({ amount: a.balance, currency: code(a.currency) })),
    base,
    rateInfo.rates,
  );

  // Assets and debts side by side, in the main currency.
  const inMain = (a: AccountWithBalance) =>
    convert(a.balance, code(a.currency), base, rateInfo.rates) ?? 0;
  const assets = active
    .filter((a) => a.balance > 0)
    .reduce((sum, a) => sum + inMain(a), 0);
  const debts = active
    .filter((a) => a.balance < 0)
    .reduce((sum, a) => sum - inMain(a), 0);
  const hasDebtPlan = active.some(
    (a) => (a.type === "loan" || a.type === "credit_card") && a.balance < 0,
  );

  return (
    <div className="flex flex-col gap-4">
      {/* One summary: assets, debts and net worth (or just the total), with
          the per-currency totals underneath when there is more than one. */}
      {totals.length > 0 && (
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
            {debts > 0 && (
              <>
                <Figure label={t("assets")}>
                  <Amount value={assets} currency={base} locale={locale} />
                </Figure>
                <Figure label={t("debts")}>
                  <Amount value={-debts} currency={base} locale={locale} />
                </Figure>
              </>
            )}
            <Figure
              label={
                debts > 0 ? t("netWorth") : t("totalIn", { currency: base })
              }
              large
            >
              <Amount
                value={debts > 0 ? assets - debts : overall.total}
                currency={base}
                locale={locale}
              />
            </Figure>
            {hasDebtPlan && (
              <Link
                href="/debts"
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className: "ml-auto self-center",
                })}
              >
                {t("debtPlan")}
              </Link>
            )}
          </div>
          {multiCurrency && (
            <div className="flex flex-col gap-1 border-t pt-3">
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {totals.map(([currency, total]) => (
                  <span key={currency}>
                    {t("total", { currency })}:{" "}
                    <Amount
                      value={total}
                      currency={currency}
                      locale={locale}
                      className="font-medium text-foreground"
                    />
                  </span>
                ))}
              </p>
              <RatesNote info={rateInfo} missing={overall.missing.length > 0} />
            </div>
          )}
        </Card>
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
            converted={inBase(account)}
            base={base}
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
                converted={inBase(account)}
                base={base}
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
  converted,
  base,
}: {
  account: AccountWithBalance;
  typeLabel: string;
  locale: string;
  /** Balance in the main currency when the account uses another one. */
  converted: number | null;
  base: string;
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
      <div className="text-right">
        <Amount
          value={account.balance}
          currency={account.currency}
          locale={locale}
          className="font-medium"
        />
        {converted !== null && (
          <p className="text-xs text-muted-foreground">
            ≈ <Amount value={converted} currency={base} locale={locale} />
          </p>
        )}
      </div>
    </Link>
  );
}

function Figure({
  label,
  large = false,
  children,
}: {
  label: string;
  large?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div
        className={
          large
            ? "text-2xl font-semibold tracking-tight"
            : "text-lg font-semibold"
        }
      >
        {children}
      </div>
    </div>
  );
}
