import { LogOut } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { getProfile } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";

export async function UserMenu() {
  const [profile, locale, t] = await Promise.all([
    getProfile(),
    getLocale(),
    getTranslations("Auth"),
  ]);

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        {profile.displayName && (
          <p className="truncate text-sm font-medium">{profile.displayName}</p>
        )}
        <p className="truncate text-xs text-muted-foreground">
          {profile.email}
        </p>
      </div>
      <form action={signOut}>
        <input type="hidden" name="locale" value={locale} />
        <button
          type="submit"
          title={t("signOut")}
          aria-label={t("signOut")}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );
}

export function UserMenuSkeleton() {
  return <div className="h-9 animate-pulse rounded-md bg-muted" />;
}
