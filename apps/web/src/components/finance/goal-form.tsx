"use client";

import {
  CURRENCIES,
  type CurrencyCode,
  formatAmountInput,
  type Locale,
} from "@projectb/core";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { useFormErrors } from "@/components/auth/use-form-errors";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFieldId } from "@/components/ui/use-field-id";
import { saveGoal } from "@/lib/actions/planning";
import { initialFormState } from "@/lib/actions/state";

type Props = {
  goal?: {
    id: string;
    name: string;
    targetAmount: number;
    currency: CurrencyCode;
    targetDate: string | null;
    accountId: string | null;
  };
  /** Accounts a goal can follow (no credit cards). */
  accounts: { id: string; name: string; currency: CurrencyCode }[];
  defaultCurrency: CurrencyCode;
};

export function GoalForm({ goal, accounts, defaultCurrency }: Props) {
  const fid = useFieldId();
  const t = useTranslations("Goals");
  const tCommon = useTranslations("Common");
  const locale = useLocale() as Locale;
  const [state, action] = useActionState(
    saveGoal.bind(null, locale, goal?.id ?? null),
    initialFormState,
  );
  const { formError, fieldError } = useFormErrors(state);
  const values = state.values ?? {
    name: goal?.name ?? "",
    targetAmount: goal
      ? formatAmountInput(goal.targetAmount, goal.currency, locale)
      : "",
    currency: goal?.currency ?? defaultCurrency,
    targetDate: goal?.targetDate ?? "",
    accountId: goal?.accountId ?? "",
  };
  const [accountId, setAccountId] = useState(values.accountId ?? "");
  const [currency, setCurrency] = useState(values.currency ?? defaultCurrency);
  const linked = accounts.find((a) => a.id === accountId);

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
      <Field
        id={fid("accountId")}
        label={t("account")}
        hint={t("accountHint")}
        error={fieldError("accountId")}
      >
        <Select
          id={fid("accountId")}
          name="accountId"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        >
          <option value="">{t("manual")}</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {t("linkedTo", { account: a.name })}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          id={fid("targetAmount")}
          label={t("targetAmount")}
          error={fieldError("targetAmount")}
        >
          <Input
            id={fid("targetAmount")}
            name="targetAmount"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={values.targetAmount}
            required
            aria-invalid={Boolean(fieldError("targetAmount"))}
          />
        </Field>
        <Field
          id={fid("currency")}
          label={t("currency")}
          error={fieldError("currency")}
        >
          {/* A linked goal always uses its account's currency. */}
          <input
            type="hidden"
            name="currency"
            value={linked?.currency ?? currency}
          />
          <Select
            id={fid("currency")}
            value={linked?.currency ?? currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            disabled={Boolean(linked)}
          >
            {Object.keys(CURRENCIES).map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          id={fid("targetDate")}
          label={`${t("targetDate")} (${tCommon("optional")})`}
          error={fieldError("targetDate")}
        >
          <Input
            id={fid("targetDate")}
            name="targetDate"
            type="date"
            defaultValue={values.targetDate}
            aria-invalid={Boolean(fieldError("targetDate"))}
          />
        </Field>
      </div>
      <div>
        <SubmitButton>{goal ? tCommon("save") : t("new")}</SubmitButton>
      </div>
    </form>
  );
}
