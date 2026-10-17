import { DEFAULT_LOCALE } from "@projectb/core";
import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { localeOfPath, safeNext } from "@/lib/redirects";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for links in Supabase auth emails (sign-up confirmation and
 * password reset). Exchanges the one-time code for a session, then continues.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(
    searchParams.get("next"),
    `/${DEFAULT_LOCALE}/dashboard`,
  );
  const locale = localeOfPath(next) ?? DEFAULT_LOCALE;

  const supabase = await createClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let error: unknown = new Error("Missing code");
  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    }));
  }

  return NextResponse.redirect(
    new URL(error ? `/${locale}/login?error=link` : next, origin),
  );
}
