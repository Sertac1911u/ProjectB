import { DEFAULT_CURRENCY, isCurrencyCode } from "@projectb/core";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { EnvelopeForm } from "@/components/finance/envelope-form";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { getProfile } from "@/lib/auth";
import { today } from "@/lib/dates";

export default async function NewEnvelopePage() {
  const t = await getTranslations("Envelopes");
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("newTitle")} description={t("hint")} />
      <Suspense
        fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}
      >
        <NewEnvelope />
      </Suspense>
    </div>
  );
}

async function NewEnvelope() {
  // The earliest payment date is today.
  await connection();
  const profile = await getProfile();
  return (
    <Card className="p-6">
      <EnvelopeForm
        currency={
          isCurrencyCode(profile.baseCurrency)
            ? profile.baseCurrency
            : DEFAULT_CURRENCY
        }
        today={today()}
      />
    </Card>
  );
}
