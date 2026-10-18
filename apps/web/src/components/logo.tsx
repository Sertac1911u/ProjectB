import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/** The ring: money set aside until payday, most of the way round. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className}>
      <rect width="64" height="64" rx="16" className="fill-primary" />
      <g className="stroke-primary-foreground" fill="none" strokeWidth="6">
        <circle cx="32" cy="32" r="16" strokeOpacity=".35" />
        <path d="M32 16a16 16 0 0 1 15.2 21" strokeLinecap="round" />
      </g>
      <circle cx="32" cy="32" r="4" className="fill-primary-foreground" />
    </svg>
  );
}

export async function Logo() {
  const t = await getTranslations("Common");
  return (
    <Link href="/" className="flex items-center gap-2.5 font-semibold">
      <LogoMark className="size-8 shrink-0" />
      <span className="sidebar-collapsed:sr-only">{t("appName")}</span>
    </Link>
  );
}
