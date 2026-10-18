import { Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function Logo() {
  const t = await getTranslations("Common");
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Wallet className="size-4" />
      </span>
      <span className="sidebar-collapsed:sr-only">{t("appName")}</span>
    </Link>
  );
}
