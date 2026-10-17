import "server-only";
import { asUser, type JwtClaims, profiles } from "@projectb/db";
import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { cache } from "react";
import { redirect } from "@/i18n/navigation";
import { getDb } from "./db";
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
