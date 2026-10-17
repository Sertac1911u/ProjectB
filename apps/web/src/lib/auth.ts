import "server-only";
import { asUser, type JwtClaims, profiles, type Tx } from "@projectb/db";
import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { cache } from "react";
import { redirect } from "@/i18n/navigation";
import { getDb } from "./db";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./supabase/config";
import { createClient } from "./supabase/server";

/** The signed-in user's verified JWT claims, or null when signed out. */
export const getClaims = cache(async (): Promise<JwtClaims | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  return data.claims as JwtClaims;
});

export async function requireClaims(): Promise<JwtClaims> {
  const claims = await getClaims();
  if (!claims) {
    return redirect({ href: "/login", locale: await getLocale() });
  }
  return claims;
}

export const getProfile = cache(async () => {
  const claims = await requireClaims();
  const [profile] = await asUser(getDb(), claims, (tx) =>
    tx.select().from(profiles).where(eq(profiles.id, claims.sub)),
  );
  if (!profile) throw new Error(`Profile missing for user ${claims.sub}`);
  return {
    ...profile,
    email: typeof claims.email === "string" ? claims.email : "",
  };
});

/** Runs queries as the signed-in user (row level security applies). */
export async function withUser<T>(
  run: (tx: Tx, claims: JwtClaims) => Promise<T>,
) {
  const claims = await requireClaims();
  return asUser(getDb(), claims, (tx) => run(tx, claims));
}

/**
 * Checks the signed-in user's password before a destructive action. Uses a
 * throwaway client so the browser session is left as it is.
 */
export async function verifyPassword(password: string): Promise<boolean> {
  const claims = await requireClaims();
  const email = typeof claims.email === "string" ? claims.email : "";
  if (!email || !password) return false;
  const { url, key } = supabaseConfig();
  const client = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return false;
  // End only the session this check opened.
  await client.auth.signOut({ scope: "local" });
  return true;
}
