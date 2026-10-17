import { DEFAULT_CURRENCY, isCurrencyCode } from "@projectb/core";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AccountForm } from "@/components/finance/account-form";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { getProfile } from "@/lib/auth";

export default async function NewAccountPage() {
  const t = await getTranslations("Accounts");
  return (
    <div className="max-w-xl">
      <PageHeader title={t("newTitle")} />
      <Card className="p-6">
        <Suspense
          fallback={<div className="h-72 animate-pulse rounded-md bg-muted" />}
        >
          <NewAccountForm />
        </Suspense>
      </Card>
    </div>
  );
}

async function NewAccountForm() {
  const profile = await getProfile();
  return (
    <AccountForm
      defaultCurrency={
        isCurrencyCode(profile.baseCurrency)
          ? profile.baseCurrency
          : DEFAULT_CURRENCY
      }
    />
  );
}
