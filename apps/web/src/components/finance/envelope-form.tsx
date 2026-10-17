"use client";

import {
  type CurrencyCode,
  ENVELOPE_REPEATS,
  formatAmountInput,
  formatMoney,
  type Locale,
  parseMoney,
  wholeMonths,
} from "@projectb/core";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { useFormErrors } from "@/components/auth/use-form-errors";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFieldId } from "@/components/ui/use-field-id";
import { saveEnvelope } from "@/lib/actions/cashflow";
import { initialFormState } from "@/lib/actions/state";

type Props = {
  envelope?: {
    id: string;
    name: string;
    amount: number;
    dueOn: string;
    intervalMonths: number | null;
  };
  currency: CurrencyCode;
  today: string;
};

export function EnvelopeForm({ envelope, currency, today }: Props) {
  const fid = useFieldId();
  const t = useTranslations("Envelopes");
  const tCommon = useTranslations("Common");
  const locale = useLocale() as Locale;
  const [state, action] = useActionState(
    saveEnvelope.bind(null, locale, envelope?.id ?? null),
    initialFormState,
  );
  const { formError, fieldError } = useFormErrors(state);
  const values = state.values ?? {
    name: envelope?.name ?? "",
    amount: envelope
      ? formatAmountInput(envelope.amount, currency, locale)
      : "",
    dueOn: envelope?.dueOn ?? "",
    repeat: String(envelope?.intervalMonths ?? 0),
  };
  const [amount, setAmount] = useState(values.amount ?? "");
  const [dueOn, setDueOn] = useState(values.dueOn ?? "");
  const parsed = parseMoney(amount, currency, locale);
  const monthly =
    parsed && parsed > 0 && dueOn >= today
      ? Math.ceil(parsed / wholeMonths(today, dueOn))
      : null;

  return (
    <form
      key={state.nonce ?? "initial"}
      action={action}
      className="flex flex-col gap-4"
      noValidate
    >
      {formError && <Alert>{formError}</Alert>}
      <Field id={fid("name")} label={t("name")} error={fieldError("name")}>
        <Input
          id={fid("name")}
          name="name"
          maxLength={60}
          placeholder={t("namePlaceholder")}
          defaultValue={values.name}
          required
          aria-invalid={Boolean(fieldError("name"))}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          id={fid("amount")}
          label={t("amount", { currency })}
          error={fieldError("amount")}
        >
          <Input
            id={fid("amount")}
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            aria-invalid={Boolean(fieldError("amount"))}
          />
        </Field>
        <Field id={fid("dueOn")} label={t("dueOn")} error={fieldError("dueOn")}>
          <Input
            id={fid("dueOn")}
            name="dueOn"
            type="date"
            min={today}
            value={dueOn}
            onChange={(e) => setDueOn(e.target.value)}
            required
            aria-invalid={Boolean(fieldError("dueOn"))}
          />
        </Field>
        <Field id={fid("repeat")} label={t("repeat")}>
          <Select id={fid("repeat")} name="repeat" defaultValue={values.repeat}>
            {ENVELOPE_REPEATS.map((months) => (
              <option key={months} value={months}>
                {t(`repeats.${months}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {monthly !== null && (
        <p className="text-sm text-muted-foreground">
          {t("monthly", { amount: formatMoney(monthly, currency, locale) })}
        </p>
      )}
      <div>
        <SubmitButton>{envelope ? tCommon("save") : t("new")}</SubmitButton>
      </div>
    </form>
  );
}
