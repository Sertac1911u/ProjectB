"use client";

import {
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
import { useFieldId } from "@/components/ui/use-field-id";
import { saveBudget } from "@/lib/actions/planning";
import { initialFormState } from "@/lib/actions/state";

type Props = {
  /** First day of the month the limit applies from. */
  month: string;
  monthLabel: string;
  currency: CurrencyCode;
  /** Expense categories that can get a budget ("Transport › Fuel"). */
  options: { id: string; label: string }[];
  budget?: { categoryId: string; amount: number };
  defaultCategoryId?: string;
};

export function BudgetForm({
  month,
  monthLabel,
  currency,
  options,
  budget,
  defaultCategoryId,
}: Props) {
  const fid = useFieldId();
  const t = useTranslations("Budgets");
  const tCommon = useTranslations("Common");
  const locale = useLocale() as Locale;
  const [state, action] = useActionState(
    saveBudget.bind(null, locale),
    initialFormState,
  );
  const { formError, fieldError } = useFormErrors(state);
  const values = state.values ?? {
    categoryId: budget?.categoryId ?? defaultCategoryId ?? "",
    amount: budget ? formatAmountInput(budget.amount, currency, locale) : "",
  };

  return (
    <form
      key={state.nonce ?? "initial"}
      action={action}
      className="flex flex-col gap-4"
      noValidate
    >
      {formError && <Alert>{formError}</Alert>}
      <input type="hidden" name="month" value={month} />
      {budget && (
        <input type="hidden" name="categoryId" value={budget.categoryId} />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={fid("categoryId")}
          label={t("category")}
          error={fieldError("categoryId")}
        >
          <Select
            id={fid("categoryId")}
            name={budget ? undefined : "categoryId"}
            defaultValue={values.categoryId}
            disabled={Boolean(budget)}
            aria-invalid={Boolean(fieldError("categoryId"))}
          >
            {!budget && <option value="">{t("chooseCategory")}</option>}
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          id={fid("amount")}
          label={t("amount", { currency })}
          error={fieldError("amount")}
          hint={t("fromMonth", { month: monthLabel })}
        >
          <Input
            id={fid("amount")}
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={values.amount}
            required
            autoFocus={Boolean(budget)}
            aria-invalid={Boolean(fieldError("amount"))}
          />
        </Field>
      </div>
      <div>
        <SubmitButton>{budget ? tCommon("save") : t("new")}</SubmitButton>
      </div>
    </form>
  );
}
