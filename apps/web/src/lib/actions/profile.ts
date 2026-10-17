"use server";

import {
  fieldErrors,
  isLocale,
  isUiMode,
  type Locale,
  profileSchema,
} from "@projectb/core";
import { asUser, profiles } from "@projectb/db";
import { eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getClaims, verifyPassword } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDb } from "@/lib/db";
import { type FormState, respond } from "./state";

async function claimsOrSignIn(locale: Locale) {
  const claims = await getClaims();
  if (!claims) redirect(`/${locale}/login`);
  return claims;
}

export async function updateProfile(
  currentLocale: Locale,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const claims = await claimsOrSignIn(currentLocale);
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  }

  await asUser(getDb(), claims, (tx) =>
    tx.update(profiles).set(parsed.data).where(eq(profiles.id, claims.sub)),
  );

  if (parsed.data.locale !== currentLocale) {
    redirect(`/${parsed.data.locale}/settings`);
  }
  refresh();
  return { status: "success" };
}

/** Remembers the language picked in the app's language switcher. */
export async function saveLocale(locale: string) {
  if (!isLocale(locale)) return;
  const claims = await getClaims();
  if (!claims) return;
  await asUser(getDb(), claims, (tx) =>
    tx.update(profiles).set({ locale }).where(eq(profiles.id, claims.sub)),
  );
}

/** Saves the answer to "how do you want to use the app?". */
export async function chooseUiMode(locale: Locale, mode: string) {
  const claims = await claimsOrSignIn(locale);
  if (!isUiMode(mode)) return;
  await asUser(getDb(), claims, (tx) =>
    tx
      .update(profiles)
      .set({ uiMode: mode })
      .where(eq(profiles.id, claims.sub)),
  );
  refresh();
}

/** Deletes everything the user entered, after checking their password. */
export async function resetData(
  locale: Locale,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const claims = await claimsOrSignIn(locale);
  if (!(await verifyPassword(String(formData.get("password") ?? "")))) {
    return respond({
      status: "error",
      fieldErrors: { password: "wrongPassword" },
    });
  }
  await asUser(getDb(), claims, (tx) =>
    tx.execute(sql`select public.reset_own_data()`),
  );
  redirect(`/${locale}/dashboard`);
}

/** Deletes the user and all their data, after checking their password. */
export async function deleteUserAccount(
  locale: Locale,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const claims = await claimsOrSignIn(locale);
  if (!(await verifyPassword(String(formData.get("password") ?? "")))) {
    return respond({
      status: "error",
      fieldErrors: { password: "wrongPassword" },
    });
  }
  try {
    await asUser(getDb(), claims, (tx) =>
      tx.execute(sql`select public.delete_own_account()`),
    );
  } catch (error) {
    console.error("[account] Could not delete the account:", error);
    return respond({ status: "error", error: "unknown" });
  }
  // The user no longer exists; only the browser's session cookies remain.
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect(`/${locale}/login?deleted=1`);
}
