import { z } from "zod";
import { CURRENCIES, type CurrencyCode } from "./currency";
import { UI_MODES } from "./finance";
import { LOCALES } from "./locale";
import { error } from "./validation";

export const PASSWORD_MIN_LENGTH = 8;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email(error("invalidEmail")));
const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, error("passwordTooShort"))
  .max(72, error("passwordTooLong"));

export const signInSchema = z.object({
  email,
  password: z.string().min(1, error("passwordTooShort")),
});

export const signUpSchema = z.object({ email, password });

export const forgotPasswordSchema = z.object({ email });

export const updatePasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    ...error("passwordsDoNotMatch"),
    path: ["confirmPassword"],
  });

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(60, error("displayNameTooLong"))
    .transform((value) => value || null),
  locale: z.enum(LOCALES, error("invalidLocale")),
  baseCurrency: z.enum(
    Object.keys(CURRENCIES) as [CurrencyCode, ...CurrencyCode[]],
    error("invalidCurrency"),
  ),
  uiMode: z.enum(UI_MODES, error("invalidUiMode")),
});
