"use client";

import {
  type CurrencyCode,
  formatMoney,
  parseMoney,
  spendImpact,
} from "@projectb/core";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useFieldId } from "@/components/ui/use-field-id";
import { cn } from "@/lib/utils";

/** "What if I spend this today?" against the cash flow forecast. */
export function SpendCalculator({
  currency,
  safeToSpend,
  daysLeft,
  windowEndBalance,
  toPayday,
}: {
  currency: CurrencyCode;
  safeToSpend: number;
  daysLeft: number;
  windowEndBalance: number;
  toPayday: boolean;
}) {
  const fid = useFieldId();
  const locale = useLocale();
  const t = useTranslations("CashFlow");
  const [text, setText] = useState("");
  const amount = parseMoney(text, currency, locale);
  const impact =
    amount !== null && amount > 0
      ? spendImpact({ safeToSpend, daysLeft, windowEndBalance }, amount)
      : null;
  const money = (v: number) => formatMoney(v, currency, locale);

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={fid("spend")} className="text-sm font-medium">
        {t("spendAmount", { currency })}
      </label>
      <Input
        id={fid("spend")}
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="max-w-60"
      />
      {impact && (
        <p
          role="status"
          className={cn(
            "text-sm",
            impact.fits ? "text-foreground" : "text-destructive",
          )}
        >
          {impact.fits
            ? t(toPayday ? "impactFits" : "impactFitsMonth", {
                daily: money(impact.dailyLimit),
                balance: money(impact.windowEndBalance),
              })
            : t(toPayday ? "impactShort" : "impactShortMonth", {
                amount: money(-impact.safeToSpend),
              })}
        </p>
      )}
    </div>
  );
}
