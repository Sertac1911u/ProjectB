"use server";

import {
  DEFAULT_LOCALE,
  fieldErrors,
  forgotPasswordSchema,
  isLocale,
  type Locale,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "@projectb/core";
import { asUser, profiles } from "@projectb/db";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { safeNext } from "@/lib/redirects";
import { createClient } from "@/lib/supabase/server";
import { authErrorCode, type FormState } from "./state";

function formLocale(formData: FormData): Locale {
  const locale = formData.get("locale");
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
}

async function callbackUrl(next: string) {
  const origin =
    (await headers()).get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";
  return `${origin}/api/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function signIn(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  const values = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error)
    return { status: "error", error: authErrorCode(error, "signIn"), values };

  // Continue in the language the user chose in their profile.
  const [profile] = await asUser(
    getDb(),
    { sub: data.user.id, role: "authenticated" },
    (tx) =>
      tx
        .select({ locale: profiles.locale })
        .from(profiles)
        .where(eq(profiles.id, data.user.id)),
  );
  const locale = isLocale(profile?.locale)
    ? profile.locale
    : formLocale(formData);
  redirect(safeNext(formData.get("next"), `/${locale}/dashboard`));
}

export async function signUp(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  const values = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values };
  }

  const locale = formLocale(formData);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: {
      data: { locale },
      emailRedirectTo: await callbackUrl(`/${locale}/dashboard`),
    },
  });
  if (error)
    return { status: "error", error: authErrorCode(error, "signUp"), values };

  // Without email confirmation Supabase signs the user in right away.
  if (data.session) redirect(`/${locale}/dashboard`);
  return { status: "success", values: { email: parsed.data.email } };
}

export async function requestPasswordReset(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  const values = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values };
  }

  const locale = formLocale(formData);
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: await callbackUrl(`/${locale}/reset-password`),
    },
  );
  // Report success even for unknown addresses so accounts cannot be probed.
  if (error && authErrorCode(error, "requestPasswordReset") === "rateLimited") {
    return { status: "error", error: "rateLimited", values };
  }
  return { status: "success" };
}

export async function updatePassword(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = updatePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error)
    return { status: "error", error: authErrorCode(error, "updatePassword") };
  return { status: "success" };
}

export async function signOut(formData: FormData) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${formLocale(formData)}/login`);
}
