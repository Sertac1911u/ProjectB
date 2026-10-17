import { cn } from "@/lib/utils";

const TONES = {
  default: "bg-primary",
  warning: "bg-warning",
  danger: "bg-destructive",
} as const;

/** A horizontal bar filled to `value` percent (0-100). */
export function Progress({
  value,
  label,
  tone = "default",
  className,
}: {
  value: number;
  label: string;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  const percent = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("h-2 overflow-hidden rounded-full bg-muted", className)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      aria-label={label}
    >
      <div
        className={cn("h-full rounded-full", TONES[tone])}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
