"use client";

import {
  ACCOUNT_TYPES,
  CURRENCIES,
  type CurrencyCode,
  formatAmountInput,
  type Locale,
} from "@projectb/core";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { useFormErrors } from "@/components/auth/use-form-errors";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveAccount } from "@/lib/actions/finance";
import { initialFormState } from "@/lib/actions/state";
import { useFieldId } from "@/components/ui/use-field-id";

type Props = {
  account?: {
    id: string;
    name: string;
    type: string;
    currency: CurrencyCode;
    openingBalance: number;
  };
  defaultCurrency: CurrencyCode;
  /** The currency cannot change once transactions use the account. */
  currencyLocked?: boolean;
};

export function AccountForm({
  account,
  defaultCurrency,
  currencyLocked = false,
}: Props) {
  const fid = useFieldId();
  const t = useTranslations("Accounts");
  const tTypes = useTranslations("AccountTypes");
  const tCommon = useTranslations("Common");
  const tSettings = useTranslations("Settings");
  const locale = useLocale() as Locale;
  const [state, action] = useActionState(
    saveAccount.bind(null, locale, account?.id ?? null),
    initialFormState,
  );
  const { formError, fieldError } = useFormErrors(state);
  const values = state.values ?? {
    name: account?.name ?? "",
    type: account?.type ?? "bank",
    currency: account?.currency ?? defaultCurrency,
    openingBalance: account
      ? formatAmountInput(account.openingBalance, account.currency, locale)
      : "",
  };

  return (
    // Remount after each attempt so React's form reset keeps submitted values.
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
          placeholder={t("namePlaceholder")}
          defaultValue={values.name}
          maxLength={60}
          required
          aria-invalid={Boolean(fieldError("name"))}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={fid("type")} label={t("type")} error={fieldError("type")}>
          <Select id={fid("type")} name="type" defaultValue={values.type}>
            {ACCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {tTypes(type)}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          id={fid("currency")}
          label={t("currency")}
          hint={currencyLocked ? t("currencyLocked") : undefined}
          error={fieldError("currency")}
        >
          {currencyLocked && (
            <input type="hidden" name="currency" value={values.currency} />
          )}
          <Select
            id={fid("currency")}
            name={currencyLocked ? undefined : "currency"}
            defaultValue={values.currency}
            disabled={currencyLocked}
          >
            {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => (
              <option key={code} value={code}>
                {tSettings(`currencies.${code}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field
        id={fid("openingBalance")}
        label={`${t("openingBalance")} (${tCommon("optional")})`}
        hint={t("openingBalanceHint")}
        error={fieldError("openingBalance")}
      >
        <Input
          id={fid("openingBalance")}
          name="openingBalance"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          defaultValue={values.openingBalance}
          aria-invalid={Boolean(fieldError("openingBalance"))}
        />
      </Field>
      <div>
        <SubmitButton>{tCommon("save")}</SubmitButton>
      </div>
    </form>
  );
}
