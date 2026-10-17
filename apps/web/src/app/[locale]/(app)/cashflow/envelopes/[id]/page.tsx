import {
  DEFAULT_CURRENCY,
  envelopeCycle,
  isCurrencyCode,
  type Locale,
} from "@projectb/core";
import { Check, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { EnvelopeForm } from "@/components/finance/envelope-form";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { SubmitButton } from "@/components/ui/submit-button";
import { deleteEnvelope, markEnvelopePaid } from "@/lib/actions/cashflow";
import { getEnvelopes } from "@/lib/data/cashflow";
import { today } from "@/lib/dates";
import { isUuid } from "@/lib/ids";

type Params = PageProps<"/[locale]/cashflow/envelopes/[id]">["params"];

export default async function EditEnvelopePage({ params }: { params: Params }) {
  const t = await getTranslations("Envelopes");
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("editTitle")} />
      <Suspense
        fallback={<div className="h-80 animate-pulse rounded-xl bg-muted" />}
      >
        <EditEnvelope params={params} />
      </Suspense>
    </div>
  );
}

async function EditEnvelope({ params }: { params: Params }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  await connection();
  const [envelopes, locale, t, tCommon] = await Promise.all([
    getEnvelopes(),
    getLocale() as Promise<Locale>,
    getTranslations("Envelopes"),
    getTranslations("Common"),
  ]);
  const envelope = envelopes.find((e) => e.id === id);
  if (!envelope) notFound();
  const day = today();
  const cycle = envelopeCycle(envelope, day);

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-6">
        <EnvelopeForm
          envelope={{ ...envelope, dueOn: cycle.due }}
          currency={
            isCurrencyCode(envelope.currency)
              ? envelope.currency
              : DEFAULT_CURRENCY
          }
          today={day}
        />
      </Card>
      <Card className="flex flex-col gap-3 p-6">
        <div className="flex flex-wrap gap-2">
          <form action={markEnvelopePaid.bind(null, locale, envelope.id)}>
            <SubmitButton variant="outline">
              <Check />
              {t("paid")}
            </SubmitButton>
          </form>
          <form action={deleteEnvelope.bind(null, locale, envelope.id)}>
            <ConfirmSubmit
              variant="destructive"
              message={tCommon("confirmDelete")}
            >
              <Trash2 />
              {tCommon("delete")}
            </ConfirmSubmit>
          </form>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("paidHint")} {t("deleteHint")}
        </p>
      </Card>
    </div>
  );
}
