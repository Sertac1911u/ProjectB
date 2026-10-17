import {
  Banknote,
  Coins,
  CreditCard,
  HandCoins,
  Landmark,
  type LucideIcon,
  PiggyBank,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  cash: Banknote,
  bank: Landmark,
  credit_card: CreditCard,
  savings: PiggyBank,
  loan: HandCoins,
  gold: Coins,
};

export function AccountIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const Icon = ICONS[type] ?? Landmark;
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground",
        className,
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}
