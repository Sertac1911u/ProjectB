import { DEFAULT_CURRENCY, isCurrencyCode } from "@projectb/core";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { GoalForm } from "@/components/finance/goal-form";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { getProfile } from "@/lib/auth";
import { goalAccounts } from "@/lib/data/planning";

export default async function NewGoalPage() {
  const t = await getTranslations("Goals");
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("newTitle")} />
      <Suspense
        fallback={<div className="h-80 animate-pulse rounded-xl bg-muted" />}
      >
        <NewGoal />
      </Suspense>
    </div>
  );
}

async function NewGoal() {
  const [accounts, profile] = await Promise.all([goalAccounts(), getProfile()]);
  return (
    <Card className="p-6">
      <GoalForm
        accounts={accounts}
        defaultCurrency={
          isCurrencyCode(profile.baseCurrency)
            ? profile.baseCurrency
            : DEFAULT_CURRENCY
        }
      />
    </Card>
  );
}
