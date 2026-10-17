import { isLocale, type Locale } from "@projectb/core";

const PROTECTED = [
  "/dashboard",
  "/cashflow",
  "/resilience",
  "/accounts",
  "/transactions",
  "/recurring",
  "/budgets",
  "/goals",
  "/debts",
  "/reports",
  "/settings",
  "/reset-password",
];
const GUEST_ONLY = ["/login", "/signup", "/forgot-password"];

function splitLocale(pathname: string): { locale?: Locale; path: string } {
  const [, first, ...rest] = pathname.split("/");
  return isLocale(first)
    ? { locale: first, path: `/${rest.join("/")}` }
    : { path: pathname };
}

const matches = (path: string, prefixes: string[]) =>
  prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

/**
 * Decides where a request should be sent based on whether the user is signed
 * in. Returns null when the request may continue.
 */
export function authRedirect(
  pathname: string,
  search: string,
  signedIn: boolean,
): string | null {
  const { locale, path } = splitLocale(pathname);
  if (!locale) return null;

  if (!signedIn && matches(path, PROTECTED)) {
    return `/${locale}/login?next=${encodeURIComponent(pathname + search)}`;
  }
  if (signedIn && matches(path, GUEST_ONLY)) {
    return `/${locale}/dashboard`;
  }
  return null;
}

/** Accepts only same-origin relative paths to prevent open redirects. */
export function safeNext(next: unknown, fallback: string): string {
  if (typeof next !== "string" || !next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

export function localeOfPath(pathname: string): Locale | undefined {
  return splitLocale(pathname).locale;
}
