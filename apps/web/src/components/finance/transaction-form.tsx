"use client";

import {
  convert,
  FREQUENCIES,
  type Frequency,
  MAX_INTERVAL,
  MAX_OCCURRENCES,
  upcomingOccurrences,
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
import { saveRecurring } from "@/lib/actions/recurring";
import { type FormState, initialFormState } from "@/lib/actions/state";
import { categoryName, categoryTree } from "@/lib/categories";
import { formatDay, today as todayIn } from "@/lib/dates";
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
  // Recurring rules only.
  frequency?: Frequency;
  interval?: number;
  endOn?: string | null;
  maxOccurrences?: number | null;
};

type Props = {
  transactionId?: string;
  /** "recurring" edits a recurring rule: a start date and a schedule. */
  mode?: "transaction" | "recurring";
  recurringId?: string;
  /** Latest exchange rates, to suggest the received amount of transfers. */
  rates: Rates;
  defaults: TransactionDefaults;
  accounts: AccountOption[];
  categories: CategoryOption[];
  tags: string[];
  /** The simple interface leaves out tags (existing ones are kept). */
  simple?: boolean;
};

export function TransactionForm({
  transactionId,
  recurringId,
  mode = "transaction",
  ...props
}: Props) {
  const locale = useLocale() as Locale;
  const [state, action] = useActionState(
    mode === "recurring"
      ? saveRecurring.bind(null, locale, recurringId ?? null)
      : saveTransaction.bind(null, locale, transactionId ?? null),
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
        isNew={mode === "transaction" && !transactionId}
        recurring={mode === "recurring"}
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
  recurring,
  simple = false,
}: Omit<Props, "transactionId" | "recurringId" | "mode"> & {
  state: FormState;
  locale: Locale;
  isNew: boolean;
  recurring: boolean;
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

  const [startOn, setStartOn] = useState(v?.startOn ?? defaults.occurredOn);
  const tRecurring = useTranslations("Recurring");
  const [installments, setInstallments] = useState(
    v?.installments ?? String(defaults.installmentCount ?? 1),
  );

  const isTransfer = kind === "transfer";
  // Installments are offered for credit card expenses only.
  const canPayInInstallments =
    !recurring &&
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
        {recurring ? (
          <Field
            id={fid("startOn")}
            label={tRecurring("startOn")}
            error={fieldError("startOn")}
          >
            <Input
              id={fid("startOn")}
              name="startOn"
              type="date"
              value={startOn}
              onChange={(e) => setStartOn(e.target.value)}
              required
              aria-invalid={Boolean(fieldError("startOn"))}
            />
          </Field>
        ) : (
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
        )}
      </div>

      {recurring && (
        <ScheduleFields
          startOn={startOn}
          defaults={{
            frequency: v?.frequency ?? defaults.frequency ?? "monthly",
            interval: v?.interval ?? String(defaults.interval ?? 1),
            ends:
              v?.ends ??
              (defaults.endOn
                ? "onDate"
                : defaults.maxOccurrences
                  ? "afterCount"
                  : "never"),
            endOn: v?.endOn ?? defaults.endOn ?? "",
            maxOccurrences:
              v?.maxOccurrences ?? String(defaults.maxOccurrences ?? ""),
          }}
          fieldError={fieldError}
          locale={locale}
        />
      )}

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

      {simple ? (
        <input type="hidden" name="tags" value={tagText} />
      ) : (
        <>
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
        </>
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

type ScheduleDefaults = {
  frequency: string;
  interval: string;
  ends: string;
  endOn: string;
  maxOccurrences: string;
};

/** Repeat and end settings of a recurring rule, with a preview of its dates. */
function ScheduleFields({
  startOn,
  defaults,
  fieldError,
  locale,
}: {
  startOn: string;
  defaults: ScheduleDefaults;
  fieldError: (name: string) => string | undefined;
  locale: Locale;
}) {
  const fid = useFieldId();
  const t = useTranslations("Recurring");
  const [frequency, setFrequency] = useState(defaults.frequency);
  const [interval, setIntervalCount] = useState(defaults.interval);
  const [ends, setEnds] = useState(defaults.ends);
  const [endOn, setEndOn] = useState(defaults.endOn);
  const [maxOccurrences, setMaxOccurrences] = useState(defaults.maxOccurrences);

  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(startOn) &&
    (FREQUENCIES as readonly string[]).includes(frequency);
  const preview = valid
    ? upcomingOccurrences(
        {
          startOn,
          frequency: frequency as Frequency,
          interval: Number(interval) || 1,
          endOn: ends === "onDate" && endOn ? endOn : null,
          maxOccurrences:
            ends === "afterCount" ? Number(maxOccurrences) || null : null,
        },
        0,
        3,
      )
    : [];
  const pastStart = valid && startOn < todayIn();

  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border p-4">
      <legend className="px-1 text-sm font-medium">{t("repeat")}</legend>
      <div className="grid grid-cols-[auto_6rem_1fr] items-center gap-2">
        <span className="text-sm">{t("every")}</span>
        <Select
          aria-label={t("repeat")}
          name="interval"
          value={interval}
          onChange={(e) => setIntervalCount(e.target.value)}
          aria-invalid={Boolean(fieldError("interval"))}
        >
          {Array.from({ length: MAX_INTERVAL }, (_, i) => String(i + 1)).map(
            (n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ),
          )}
        </Select>
        <Select
          aria-label={t("repeat")}
          name="frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          aria-invalid={Boolean(fieldError("frequency"))}
        >
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {t(`frequencies.${f}`)}
            </option>
          ))}
        </Select>
      </div>
      {(fieldError("interval") || fieldError("frequency")) && (
        <p className="-mt-2 text-sm text-destructive">
          {fieldError("interval") ?? fieldError("frequency")}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("ends")}</span>
        <input type="hidden" name="ends" value={ends} />
        {(["never", "onDate", "afterCount"] as const).map((option) => (
          <label
            key={option}
            className="flex flex-wrap items-center gap-2 text-sm"
          >
            <input
              type="radio"
              checked={ends === option}
              onChange={() => setEnds(option)}
              className="accent-primary"
            />
            {t(
              option === "never"
                ? "endsNever"
                : option === "onDate"
                  ? "endsOnDate"
                  : "endsAfterCount",
            )}
            {option === "onDate" && ends === "onDate" && (
              <Input
                id={fid("endOn")}
                name="endOn"
                type="date"
                aria-label={t("endOn")}
                value={endOn}
                onChange={(e) => setEndOn(e.target.value)}
                className="w-auto"
                aria-invalid={Boolean(fieldError("endOn"))}
              />
            )}
            {option === "afterCount" && ends === "afterCount" && (
              <Input
                id={fid("maxOccurrences")}
                name="maxOccurrences"
                type="number"
                min={1}
                max={MAX_OCCURRENCES}
                aria-label={t("maxOccurrences")}
                value={maxOccurrences}
                onChange={(e) => setMaxOccurrences(e.target.value)}
                className="w-24"
                aria-invalid={Boolean(fieldError("maxOccurrences"))}
              />
            )}
          </label>
        ))}
        {(fieldError("endOn") || fieldError("maxOccurrences")) && (
          <p className="text-sm text-destructive">
            {fieldError("endOn") ?? fieldError("maxOccurrences")}
          </p>
        )}
      </div>

      {preview.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("preview", {
            dates: preview
              .map((d) => formatDay(d, locale, "medium"))
              .join(", "),
          })}
        </p>
      )}
      {pastStart && (
        <p className="text-xs text-muted-foreground">{t("pastStart")}</p>
      )}
    </fieldset>
  );
}
