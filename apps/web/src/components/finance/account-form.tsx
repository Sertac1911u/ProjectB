"use client";

import {
  ACCOUNT_TYPES,
  type AccountType,
  CURRENCIES,
  type CurrencyCode,
  formatAmountInput,
  formatScaled,
  GOLD_UNITS,
  type Locale,
  QUANTITY_DECIMALS,
  RATE_DECIMALS,
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
    balance: number;
    interestRateBp: number | null;
    loanPayment: number | null;
    goldUnit: string | null;
    goldQuantity: number | null;
    unitPrice: number | null;
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
    // A card's opening balance is typed as the debt it already had.
    openingBalance: !account
      ? ""
      : account.type === "credit_card"
        ? account.openingBalance < 0
          ? formatAmountInput(-account.openingBalance, account.currency, locale)
          : ""
        : formatAmountInput(account.openingBalance, account.currency, locale),
    creditLimit:
      account?.creditLimit != null
        ? formatAmountInput(account.creditLimit, account.currency, locale)
        : "",
    statementDay: account?.statementDay ? String(account.statementDay) : "",
    dueDay: account?.dueDay ? String(account.dueDay) : "",
    minPaymentRate: String(account?.minPaymentRate ?? 20),
    interestRate:
      account?.interestRateBp != null
        ? formatScaled(account.interestRateBp, RATE_DECIMALS, locale)
        : "",
    loanPayment:
      account?.loanPayment != null
        ? formatAmountInput(account.loanPayment, account.currency, locale)
        : "",
    // A loan's balance is negative: what is owed.
    loanRemaining:
      account?.type === "loan"
        ? formatAmountInput(
            Math.max(0, -account.balance),
            account.currency,
            locale,
          )
        : "",
    goldUnit: account?.goldUnit ?? "gram",
    goldQuantity:
      account?.goldQuantity != null
        ? formatScaled(account.goldQuantity, QUANTITY_DECIMALS, locale)
        : "",
    unitPrice:
      account?.unitPrice != null
        ? formatAmountInput(account.unitPrice, account.currency, locale)
        : "",
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
      {!["credit_card", "loan", "gold"].includes(type) && (
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
      {!["credit_card", "loan", "gold"].includes(type) && (
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
      )}
      {type === "loan" && (
        <fieldset className="flex flex-col gap-4 rounded-lg border p-4">
          <legend className="px-1 text-sm font-medium">
            {t("loanSettings")}
          </legend>
          <p className="-mt-2 text-sm text-muted-foreground">
            {t("loanSettingsHint")}
          </p>
          <Field
            id={fid("loanRemaining")}
            label={t("loanRemaining")}
            hint={t("loanRemainingHint")}
            error={fieldError("loanRemaining")}
          >
            <Input
              id={fid("loanRemaining")}
              name="loanRemaining"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={values.loanRemaining}
              aria-invalid={Boolean(fieldError("loanRemaining"))}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id={fid("loanPayment")}
              label={t("loanPayment")}
              error={fieldError("loanPayment")}
            >
              <Input
                id={fid("loanPayment")}
                name="loanPayment"
                inputMode="decimal"
                autoComplete="off"
                defaultValue={values.loanPayment}
                aria-invalid={Boolean(fieldError("loanPayment"))}
              />
            </Field>
            <RateField
              id={fid("interestRate")}
              defaultValue={values.interestRate}
              error={fieldError("interestRate")}
            />
          </div>
        </fieldset>
      )}
      {type === "gold" && (
        <fieldset className="flex flex-col gap-4 rounded-lg border p-4">
          <legend className="px-1 text-sm font-medium">
            {t("goldSettings")}
          </legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id={fid("goldUnit")} label={t("goldUnit")}>
              <Select
                id={fid("goldUnit")}
                name="goldUnit"
                defaultValue={values.goldUnit}
              >
                {GOLD_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {t(`goldUnits.${unit}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              id={fid("goldQuantity")}
              label={t("goldQuantity")}
              error={fieldError("goldQuantity")}
            >
              <Input
                id={fid("goldQuantity")}
                name="goldQuantity"
                inputMode="decimal"
                autoComplete="off"
                defaultValue={values.goldQuantity}
                aria-invalid={Boolean(fieldError("goldQuantity"))}
              />
            </Field>
            <Field
              id={fid("unitPrice")}
              label={t("unitPrice")}
              error={fieldError("unitPrice")}
            >
              <Input
                id={fid("unitPrice")}
                name="unitPrice"
                inputMode="decimal"
                autoComplete="off"
                defaultValue={values.unitPrice}
                aria-invalid={Boolean(fieldError("unitPrice"))}
              />
            </Field>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            {t("unitPriceHint")}
          </p>
        </fieldset>
      )}
      {type === "credit_card" && (
        <fieldset className="flex flex-col gap-4 rounded-lg border p-4">
          <legend className="px-1 text-sm font-medium">
            {t("cardSettings")}
          </legend>
          <p className="-mt-2 text-sm text-muted-foreground">
            {t("cardSettingsHint")}
          </p>
          <Field
            id={fid("openingBalance")}
            label={`${t("cardOpeningDebt")} (${tCommon("optional")})`}
            hint={t("cardOpeningDebtHint")}
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
            <RateField
              id={fid("interestRate")}
              defaultValue={values.interestRate}
              error={fieldError("interestRate")}
              optional
            />
          </div>
        </fieldset>
      )}
      <div>
        <SubmitButton>{tCommon("save")}</SubmitButton>
      </div>
    </form>
  );
}

function RateField({
  id,
  defaultValue,
  error,
  optional = false,
}: {
  id: string;
  defaultValue?: string;
  error?: string;
  optional?: boolean;
}) {
  const t = useTranslations("Accounts");
  const tCommon = useTranslations("Common");
  return (
    <Field
      id={id}
      label={
        optional
          ? `${t("interestRate")} (${tCommon("optional")})`
          : t("interestRate")
      }
      hint={t("interestRateHint")}
      error={error}
    >
      <Input
        id={id}
        name="interestRate"
        inputMode="decimal"
        autoComplete="off"
        placeholder="3,49"
        defaultValue={defaultValue}
        aria-invalid={Boolean(error)}
      />
    </Field>
  );
}
