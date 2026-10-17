"use client";

import {
  type CurrencyCode,
  formatMoney,
  INSTALLMENT_OPTIONS,
  isCurrencyCode,
  type Locale,
} from "@projectb/core";
import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { useFormErrors } from "@/components/auth/use-form-errors";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFieldId } from "@/components/ui/use-field-id";
import { type WhatIfState, whatIf } from "@/lib/actions/cashflow";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Tries out a purchase against the cash flow forecast; nothing is saved. */
export function WhatIfForm({
  currency,
  cards,
}: {
  currency: CurrencyCode;
  cards: { id: string; name: string }[];
}) {
  const fid = useFieldId();
  const t = useTranslations("WhatIf");
  const locale = useLocale() as Locale;
  const [state, action] = useActionState<WhatIfState, FormData>(
    whatIf.bind(null, locale),
    { status: "idle" },
  );
  const { fieldError } = useFormErrors(state);
  const values = state.values ?? {};
  const [method, setMethod] = useState(values.method ?? "cash");
  const result = state.result;

  return (
    <div className="flex flex-col gap-5">
      <form
        key={state.nonce ?? "initial"}
        action={action}
        className="flex flex-col gap-4"
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
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
              defaultValue={values.amount ?? ""}
              required
              aria-invalid={Boolean(fieldError("amount"))}
            />
          </Field>
          <Field id={fid("method")} label={t("method")}>
            <Select
              id={fid("method")}
              name="method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="cash">{t("cash")}</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {t("card", { card: card.name })}
                </option>
              ))}
            </Select>
          </Field>
          {method !== "cash" && (
            <Field id={fid("installments")} label={t("installments")}>
              <Select
                id={fid("installments")}
                name="installments"
                defaultValue={values.installments ?? "1"}
              >
                {INSTALLMENT_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? t("single") : n}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        <div>
          <SubmitButton>{t("calculate")}</SubmitButton>
        </div>
      </form>

      {result && <WhatIfResult result={result} locale={locale} />}
    </div>
  );
}

function WhatIfResult({
  result,
  locale,
}: {
  result: NonNullable<WhatIfState["result"]>;
  locale: string;
}) {
  const t = useTranslations("WhatIf");
  const code = isCurrencyCode(result.currency) ? result.currency : "TRY";
  const money = (v: number) => formatMoney(v, code, locale);
  const { before, after } = result;
  const fits = after.safeToSpend >= 0;
  const rows = [
    { label: t("dailyLimit"), now: before.dailyLimit, then: after.dailyLimit },
    {
      label: result.toPayday ? t("beforePayday") : t("beforeMonthEnd"),
      now: before.windowEndBalance,
      then: after.windowEndBalance,
    },
    {
      label: t("lowest"),
      now: before.lowest.balance,
      then: after.lowest.balance,
    },
  ];

  return (
    <div role="status" className="flex flex-col gap-4 rounded-lg border p-4">
      <p
        className={cn(
          "text-sm font-medium",
          fits ? "text-accent-foreground" : "text-destructive",
        )}
      >
        {fits
          ? result.toPayday
            ? t("fits")
            : t("fitsMonth")
          : t("short", {
              date: formatDay(after.shortfallOn ?? after.lowest.on, locale),
            })}
      </p>
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className="py-1 text-left font-medium" />
            <th className="py-1 text-right font-medium">{t("now")}</th>
            <th className="py-1 text-right font-medium">{t("after")}</th>
          </tr>
        </thead>
        <tbody className="divide-y tabular-nums">
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="py-1.5">{row.label}</td>
              <td className="py-1.5 text-right text-muted-foreground">
                {money(row.now)}
              </td>
              <td
                className={cn(
                  "py-1.5 text-right font-medium",
                  row.then < 0 && "text-destructive",
                )}
              >
                {money(row.then)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {result.cardPlan.length > 0 && (
        <div className="text-sm">
          <p className="mb-1 font-medium">{t("cardPlan")}</p>
          <ul className="flex flex-col gap-0.5 text-muted-foreground">
            {result.cardPlan.slice(0, 6).map((part, i) => (
              <li key={i} className="flex items-center gap-2 tabular-nums">
                <ArrowRight className="size-3" />
                {formatDay(part.due, locale)}: {money(part.amount)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.goals.length > 0 && (
        <div className="text-sm">
          <p className="font-medium">{t("goals")}</p>
          <p className="mb-1 text-xs text-muted-foreground">{t("goalHint")}</p>
          <ul className="flex flex-col gap-0.5">
            {result.goals.map((goal) => (
              <li key={goal.id}>
                {goal.delayDays === null
                  ? t("goalUnknown", { name: goal.name })
                  : t("goalDelay", { name: goal.name, days: goal.delayDays })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
