import { type CurrencyCode, formatMoney, isCurrencyCode } from "@projectb/core";
import { cn } from "@/lib/utils";

type Props = {
  value: number;
  currency: string;
  locale: string;
  /** income shows a plus sign, expense a minus sign; otherwise the value's own sign. */
  kind?: string;
  className?: string;
};

export function Amount({ value, currency, locale, kind, className }: Props) {
  const code: CurrencyCode = isCurrencyCode(currency) ? currency : "TRY";
  const signed = kind === "expense" ? -value : value;
  const text = formatMoney(Math.abs(signed), code, locale);
  const sign = signed < 0 ? "−" : kind === "income" ? "+" : "";
  return (
    <span
      className={cn(
        "whitespace-nowrap tabular-nums",
        kind === "income" && "text-accent-foreground",
        signed < 0 && kind !== "expense" && "text-destructive",
        className,
      )}
    >
      {sign}
      {text}
    </span>
  );
}
