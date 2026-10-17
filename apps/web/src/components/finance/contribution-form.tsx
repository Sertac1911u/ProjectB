"use client";

import {
  CONTRIBUTION_DIRECTIONS,
  type CurrencyCode,
  type Locale,
} from "@projectb/core";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { useFormErrors } from "@/components/auth/use-form-errors";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFieldId } from "@/components/ui/use-field-id";
import { addContribution } from "@/lib/actions/planning";
import { initialFormState } from "@/lib/actions/state";

export function ContributionForm({
  goalId,
  currency,
  today,
}: {
  goalId: string;
  currency: CurrencyCode;
  today: string;
}) {
  const fid = useFieldId();
  const t = useTranslations("Goals");
  const tCommon = useTranslations("Common");
  const locale = useLocale() as Locale;
  const [state, action] = useActionState(
    addContribution.bind(null, locale, goalId),
    initialFormState,
  );
  const { formError, fieldError } = useFormErrors(state);
  const values = state.values ?? {
    direction: "deposit",
    amount: "",
    occurredOn: today,
    note: "",
  };

  return (
    <form
      key={state.nonce ?? "initial"}
      action={action}
      className="flex flex-col gap-4"
      noValidate
    >
      {formError && <Alert>{formError}</Alert>}
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr_10rem]">
        <Field id={fid("direction")} label={t("direction")}>
          <Select
            id={fid("direction")}
            name="direction"
            defaultValue={values.direction}
          >
            {CONTRIBUTION_DIRECTIONS.map((d) => (
              <option key={d} value={d}>
                {t(d)}
              </option>
            ))}
          </Select>
        </Field>
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
            defaultValue={values.amount}
            required
            aria-invalid={Boolean(fieldError("amount"))}
          />
        </Field>
        <Field
          id={fid("occurredOn")}
          label={t("date")}
          error={fieldError("occurredOn")}
        >
          <Input
            id={fid("occurredOn")}
            name="occurredOn"
            type="date"
            defaultValue={values.occurredOn}
            required
          />
        </Field>
      </div>
      <Field
        id={fid("note")}
        label={`${t("note")} (${tCommon("optional")})`}
        error={fieldError("note")}
      >
        <Input
          id={fid("note")}
          name="note"
          maxLength={200}
          defaultValue={values.note}
        />
      </Field>
      <div>
        <SubmitButton>{t("addContribution")}</SubmitButton>
      </div>
    </form>
  );
}
