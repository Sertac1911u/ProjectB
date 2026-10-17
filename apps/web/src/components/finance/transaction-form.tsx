"use client";

import {
  convert,
  type CurrencyCode,
  formatAmountInput,
  formatMoney,
  INSTALLMENT_OPTIONS,
  installmentAmounts,
  parseMoney,
  type Locale,
  parseTags,
  type Rates,
  TRANSACTION_KINDS,
  type TransactionKind,
} from "@projectb/core";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useRef, useState } from "react";
import { useFormErrors } from "@/components/auth/use-form-errors";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveTransaction } from "@/lib/actions/finance";
import { type FormState, initialFormState } from "@/lib/actions/state";
import { categoryName, categoryTree } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { useFieldId } from "@/components/ui/use-field-id";

type AccountOption = {
  id: string;
  name: string;
  currency: CurrencyCode;
  type: string;
};
type CategoryOption = Parameters<typeof categoryTree>[0][number];

export type TransactionDefaults = {
  kind: TransactionKind;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  amount?: number;
  toAmount?: number | null;
  occurredOn: string;
  note?: string | null;
  tags?: string[];
  installmentCount?: number;
};

type Props = {
  transactionId?: string;
  /** Latest exchange rates, to suggest the received amount of transfers. */
  rates: Rates;
  defaults: TransactionDefaults;
  accounts: AccountOption[];
  categories: CategoryOption[];
  tags: string[];
};

export function TransactionForm({ transactionId, ...props }: Props) {
  const locale = useLocale() as Locale;
  const [state, action] = useActionState(
    saveTransaction.bind(null, locale, transactionId ?? null),
    initialFormState,
  );
  return (
    // Remount after each attempt: React resets a form once its action
    // finishes, which would otherwise wipe what the user typed.
    <form
      key={state.nonce ?? "initial"}
      action={action}
      className="flex flex-col gap-4"
      noValidate
    >
      <TransactionFields
        state={state}
        locale={locale}
        isNew={!transactionId}
        {...props}
      />
    </form>
  );
}

function TransactionFields({
  state,
  locale,
  defaults,
  accounts,
  categories,
  tags,
  rates,
  isNew,
}: Omit<Props, "transactionId"> & {
  state: FormState;
  locale: Locale;
  isNew: boolean;
}) {
  const fid = useFieldId();
  const t = useTranslations("Transactions");
  const tCategories = useTranslations("Categories");
  const tCommon = useTranslations("Common");
  const tRates = useTranslations("Rates");
  const { formError, fieldError } = useFormErrors(state);

  const currencyOf = (id: string | null | undefined) =>
    accounts.find((a) => a.id === id)?.currency ?? "TRY";
  const v = state.values;
  const [kind, setKind] = useState<TransactionKind>(
    (v?.kind as TransactionKind) ?? defaults.kind,
  );
  const [accountId, setAccountId] = useState(
    v?.accountId ?? defaults.accountId,
  );
  const [toAccountId, setToAccountId] = useState(
    v?.toAccountId ??
      defaults.toAccountId ??
      accounts.find((a) => a.id !== (v?.accountId ?? defaults.accountId))?.id ??
      "",
  );
  const [tagText, setTagText] = useState(
    v?.tags ?? defaults.tags?.join(", ") ?? "",
  );

  const [installments, setInstallments] = useState(
    v?.installments ?? String(defaults.installmentCount ?? 1),
  );

  const isTransfer = kind === "transfer";
  // Installments are offered for credit card expenses only.
  const canPayInInstallments =
    kind === "expense" &&
    accounts.find((a) => a.id === accountId)?.type === "credit_card";
  const currency = currencyOf(accountId);
  const toCurrency = currencyOf(toAccountId);
  const showToAmount = isTransfer && toCurrency !== currency;
  const chosenTags = new Set(
    parseTags(tagText).map((tag) => tag.toLocaleLowerCase(locale)),
  );
  const tree = isTransfer
    ? []
    : categoryTree(categories, kind, { keepId: defaults.categoryId });

  const amountDefault =
    v?.amount ??
    (defaults.amount
      ? formatAmountInput(
          defaults.amount,
          currencyOf(defaults.accountId),
          locale,
        )
      : "");
  const [amountText, setAmountText] = useState(amountDefault);
  const installmentPreview = (() => {
    const count = Number(installments);
    const total = parseMoney(amountText, currency, locale);
    if (!canPayInInstallments || count <= 1 || !total || total <= 0)
      return undefined;
    return t("installmentPreview", {
      count,
      amount: formatMoney(
        installmentAmounts(total, count)[0]!,
        currency,
        locale,
      ),
    });
  })();
  const toAmountRef = useRef<HTMLInputElement>(null);
  const estimate = (() => {
    if (!showToAmount) return null;
    const amount = parseMoney(amountText, currency, locale);
    if (!amount || amount <= 0) return null;
    const converted = convert(amount, currency, toCurrency, rates);
    return converted && converted > 0 ? converted : null;
  })();
  const toAmountDefault =
    v?.toAmount ??
    (defaults.toAmount && defaults.toAccountId
      ? formatAmountInput(
          defaults.toAmount,
          currencyOf(defaults.toAccountId),
          locale,
        )
      : "");

  return (
    <>
      {formError && <Alert>{formError}</Alert>}
      {state.status === "success" && (
        <Alert variant="success">{t("saved")}</Alert>
      )}
      <fieldset>
        <legend className="sr-only">{t("filters.kind")}</legend>
        <div className="grid grid-cols-3 gap-1 rounded-lg border bg-muted p-1">
          {TRANSACTION_KINDS.map((value) => (
            <label
              key={value}
              className={cn(
                "cursor-pointer rounded-md px-3 py-2 text-center text-sm font-medium transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
                kind === value
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <input
                type="radio"
                name="kind"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
                className="sr-only"
              />
              {t(`kinds.${value}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className={cn("grid gap-4", isTransfer && "sm:grid-cols-2")}>
        <Field
          id={fid("accountId")}
          label={isTransfer ? t("fromAccount") : t("account")}
          error={fieldError("accountId")}
        >
          <Select
            id={fid("accountId")}
            name="accountId"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            aria-invalid={Boolean(fieldError("accountId"))}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </Select>
        </Field>
        {isTransfer && (
          <Field
            id={fid("toAccountId")}
            label={t("toAccount")}
            error={fieldError("toAccountId")}
          >
            <Select
              id={fid("toAccountId")}
              name="toAccountId"
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              aria-invalid={Boolean(fieldError("toAccountId"))}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      <div
        className={cn(
          "grid gap-4",
          (showToAmount || canPayInInstallments) && "sm:grid-cols-2",
        )}
      >
        <Field
          id={fid("amount")}
          label={`${t("amount")} (${currency})`}
          error={fieldError("amount")}
        >
          <Input
            id={fid("amount")}
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            defaultValue={amountDefault}
            onChange={(e) => setAmountText(e.target.value)}
            required
            autoFocus
            aria-invalid={Boolean(fieldError("amount"))}
          />
        </Field>
        {canPayInInstallments && (
          <Field
            id={fid("installments")}
            label={t("installments")}
            hint={installmentPreview}
            error={fieldError("installments")}
          >
            <Select
              id={fid("installments")}
              name="installments"
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
              aria-invalid={Boolean(fieldError("installments"))}
            >
              {INSTALLMENT_OPTIONS.map((count) => (
                <option key={count} value={count}>
                  {count === 1
                    ? t("singlePayment")
                    : t("installmentsOption", { count })}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {showToAmount && (
          <Field
            id={fid("toAmount")}
            label={`${t("toAmount")} (${toCurrency})`}
            hint={t("toAmountHint")}
            error={fieldError("toAmount")}
          >
            <Input
              id={fid("toAmount")}
              name="toAmount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              defaultValue={toAmountDefault}
              ref={toAmountRef}
              aria-invalid={Boolean(fieldError("toAmount"))}
            />
            {estimate !== null && (
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                {tRates("estimate", {
                  amount: formatMoney(estimate, toCurrency, locale),
                })}
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => {
                    if (toAmountRef.current) {
                      toAmountRef.current.value = formatAmountInput(
                        estimate,
                        toCurrency,
                        locale,
                      );
                    }
                  }}
                >
                  {tRates("useEstimate")}
                </button>
              </p>
            )}
          </Field>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {!isTransfer && (
          <Field
            id={fid("categoryId")}
            label={t("category")}
            error={fieldError("categoryId")}
          >
            <Select
              id={fid("categoryId")}
              name="categoryId"
              // Categories differ per kind, so reset the choice when it changes.
              key={kind}
              defaultValue={
                kind === defaults.kind
                  ? (v?.categoryId ?? defaults.categoryId ?? "")
                  : ""
              }
            >
              <option value="">{t("noCategory")}</option>
              {tree.map((parent) => (
                <optgroup
                  key={parent.id}
                  label={categoryName(parent, tCategories)}
                >
                  <option value={parent.id}>
                    {categoryName(parent, tCategories)}
                  </option>
                  {parent.children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {categoryName(parent, tCategories)} ›{" "}
                      {categoryName(child, tCategories)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
        )}
        <Field
          id={fid("occurredOn")}
          label={t("date")}
          error={fieldError("occurredOn")}
        >
          <Input
            id={fid("occurredOn")}
            name="occurredOn"
            type="date"
            defaultValue={v?.occurredOn ?? defaults.occurredOn}
            required
            aria-invalid={Boolean(fieldError("occurredOn"))}
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
          maxLength={500}
          placeholder={t("notePlaceholder")}
          defaultValue={v?.note ?? defaults.note ?? ""}
          aria-invalid={Boolean(fieldError("note"))}
        />
      </Field>

      <Field
        id={fid("tags")}
        label={`${t("tags")} (${tCommon("optional")})`}
        hint={t("tagsHint")}
        error={fieldError("tags")}
      >
        <Input
          id={fid("tags")}
          name="tags"
          autoComplete="off"
          value={tagText}
          onChange={(e) => setTagText(e.target.value)}
          aria-invalid={Boolean(fieldError("tags"))}
        />
      </Field>
      {tags.length > 0 && (
        <div className="-mt-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => {
            const chosen = chosenTags.has(tag.toLocaleLowerCase(locale));
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={chosen}
                onClick={() => {
                  const list = parseTags(tagText);
                  const next = chosen
                    ? list.filter(
                        (x) =>
                          x.toLocaleLowerCase(locale) !==
                          tag.toLocaleLowerCase(locale),
                      )
                    : [...list, tag];
                  setTagText(next.join(", "));
                }}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                  chosen
                    ? "border-primary bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tag}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <SubmitButton>{tCommon("save")}</SubmitButton>
        {isNew && (
          <SubmitButton variant="outline" name="intent" value="again">
            {t("saveAndNew")}
          </SubmitButton>
        )}
      </div>
    </>
  );
}
