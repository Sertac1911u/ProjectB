import { createServerClient } from "@supabase/ssr";
import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { authRedirect } from "./lib/redirects";
import { supabaseConfig } from "./lib/supabase/config";

const handleI18n = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  // Refresh the Supabase session first. Refreshed cookies are written to the
  // request (so pages rendered for it see them) and to the response.
  const { url, key } = supabaseConfig();
  const refreshed: { name: string; value: string; options: object }[] = [];
  let cacheHeaders: Record<string, string> = {};

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet)
          request.cookies.set(name, value);
        refreshed.push(...cookiesToSet);
        cacheHeaders = headers;
      },
    },
  });
  const { data } = await supabase.auth.getClaims();

  const { pathname, search } = request.nextUrl;
  const redirectTo = authRedirect(pathname, search, Boolean(data?.claims));
  const response = redirectTo
    ? NextResponse.redirect(new URL(redirectTo, request.url))
    : handleI18n(request);

  for (const { name, value, options } of refreshed) {
    response.cookies.set(name, value, options);
  }
  for (const [name, value] of Object.entries(cacheHeaders)) {
    response.headers.set(name, value);
  }
  return response;
}

export const config = {
  // Everything except API routes, Next.js internals and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
