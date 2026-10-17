"use client";

import {
  ACCOUNT_TYPES,
  type AccountType,
  CURRENCIES,
  type CurrencyCode,
  formatAmountInput,
  type Locale,
  SPENDABLE_BY_DEFAULT,
} from "@projectb/core";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
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
    creditLimit: number | null;
    statementDay: number | null;
    dueDay: number | null;
    minPaymentRate: number | null;
    spendable: boolean;
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
    creditLimit:
      account?.creditLimit != null
        ? formatAmountInput(account.creditLimit, account.currency, locale)
        : "",
    statementDay: account?.statementDay ? String(account.statementDay) : "",
    dueDay: account?.dueDay ? String(account.dueDay) : "",
    minPaymentRate: String(account?.minPaymentRate ?? 20),
  };
  const [type, setType] = useState(values.type);
  const byType = (t?: string) =>
    SPENDABLE_BY_DEFAULT.includes(t as AccountType);
  // Follows the account type until the user ticks or unticks it.
  const [spendable, setSpendable] = useState<boolean | null>(
    state.values
      ? state.values.spendable === "on"
      : account
        ? account.spendable
        : null,
  );
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1));

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
          <Select
            id={fid("type")}
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
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
      {type !== "credit_card" && (
        <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
          <input
            type="checkbox"
            name="spendable"
            checked={spendable ?? byType(type)}
            onChange={(e) => setSpendable(e.target.checked)}
            className="mt-0.5 size-4 accent-primary"
          />
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">{t("spendable")}</span>
            <span className="text-xs text-muted-foreground">
              {t("spendableHint")}
            </span>
          </span>
        </label>
      )}
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
      {type === "credit_card" && (
        <fieldset className="flex flex-col gap-4 rounded-lg border p-4">
          <legend className="px-1 text-sm font-medium">
            {t("cardSettings")}
          </legend>
          <p className="-mt-2 text-sm text-muted-foreground">
            {t("cardSettingsHint")}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id={fid("statementDay")}
              label={t("statementDay")}
              error={fieldError("statementDay")}
            >
              <Select
                id={fid("statementDay")}
                name="statementDay"
                defaultValue={values.statementDay}
                aria-invalid={Boolean(fieldError("statementDay"))}
              >
                <option value="">{t("chooseDay")}</option>
                {days.map((day) => (
                  <option key={day} value={day}>
                    {t("dayOption", { day })}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              id={fid("dueDay")}
              label={t("dueDay")}
              error={fieldError("dueDay")}
            >
              <Select
                id={fid("dueDay")}
                name="dueDay"
                defaultValue={values.dueDay}
                aria-invalid={Boolean(fieldError("dueDay"))}
              >
                <option value="">{t("chooseDay")}</option>
                {days.map((day) => (
                  <option key={day} value={day}>
                    {t("dayOption", { day })}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              id={fid("creditLimit")}
              label={`${t("creditLimit")} (${tCommon("optional")})`}
              error={fieldError("creditLimit")}
            >
              <Input
                id={fid("creditLimit")}
                name="creditLimit"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                defaultValue={values.creditLimit}
                aria-invalid={Boolean(fieldError("creditLimit"))}
              />
            </Field>
            <Field
              id={fid("minPaymentRate")}
              label={t("minPaymentRate")}
              hint={t("minPaymentRateHint")}
              error={fieldError("minPaymentRate")}
            >
              <Input
                id={fid("minPaymentRate")}
                name="minPaymentRate"
                type="number"
                min={0}
                max={100}
                defaultValue={values.minPaymentRate}
                aria-invalid={Boolean(fieldError("minPaymentRate"))}
              />
            </Field>
          </div>
        </fieldset>
      )}
      <div>
        <SubmitButton>{tCommon("save")}</SubmitButton>
      </div>
    </form>
  );
}
