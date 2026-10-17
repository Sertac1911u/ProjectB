import { DEFAULT_CURRENCY, isCurrencyCode, type Locale } from "@projectb/core";
import { Archive, ArchiveRestore, List } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AccountForm } from "@/components/finance/account-form";
import { DeleteAccountButton } from "@/components/finance/delete-account-button";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { Link } from "@/i18n/navigation";
import { setAccountArchived } from "@/lib/actions/finance";
import { countAccountTransactions, getAccount } from "@/lib/data/finance";
import { isUuid } from "@/lib/ids";

export default async function AccountPage({
  params,
}: PageProps<"/[locale]/accounts/[id]">) {
  const t = await getTranslations("Accounts");
  return (
    <div className="max-w-xl">
      <PageHeader title={t("editTitle")} />
      <Suspense
        fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}
      >
        <EditAccount params={params} />
      </Suspense>
    </div>
  );
}

async function EditAccount({
  params,
}: Pick<PageProps<"/[locale]/accounts/[id]">, "params">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [account, used, t, tCommon, locale] = await Promise.all([
    getAccount(id),
    countAccountTransactions(id),
    getTranslations("Accounts"),
    getTranslations("Common"),
    getLocale() as Promise<Locale>,
  ]);
  if (!account) notFound();
  const currency = isCurrencyCode(account.currency)
    ? account.currency
    : DEFAULT_CURRENCY;
  const archived = Boolean(account.archivedAt);

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-6">
        <AccountForm
          account={{ ...account, currency }}
          defaultCurrency={currency}
          currencyLocked={used > 0}
        />
      </Card>
      <Card className="flex flex-col gap-3 p-6">
        <p className="text-sm text-muted-foreground">{t("archiveHint")}</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={{ pathname: "/transactions", query: { account: account.id } }}
            className={buttonVariants({ variant: "outline" })}
          >
            <List />
            {t("transactions")}
          </Link>
          <form
            action={setAccountArchived.bind(
              null,
              locale,
              account.id,
              !archived,
            )}
          >
            <SubmitButton variant="outline">
              {archived ? <ArchiveRestore /> : <Archive />}
              {archived ? tCommon("restore") : tCommon("archive")}
            </SubmitButton>
          </form>
          {used === 0 && <DeleteAccountButton accountId={account.id} />}
        </div>
      </Card>
    </div>
  );
}
