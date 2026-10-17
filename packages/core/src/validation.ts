import type { z } from "zod";

/**
 * Validation messages are translation keys (see the `Errors` namespace in the
 * web app's messages) so every client can show them in the user's language.
 */
export type ValidationError =
  | "invalidEmail"
  | "passwordTooShort"
  | "passwordTooLong"
  | "passwordsDoNotMatch"
  | "displayNameTooLong"
  | "invalidLocale"
  | "invalidCurrency"
  | "nameRequired"
  | "nameTooLong"
  | "invalidAccountType"
  | "invalidKind"
  | "accountRequired"
  | "invalidAccount"
  | "sameAccount"
  | "invalidCategory"
  | "amountRequired"
  | "invalidAmount"
  | "amountNotPositive"
  | "invalidDate"
  | "noteTooLong"
  | "tagTooLong"
  | "tooManyTags"
  | "invalidDay"
  | "invalidRate"
  | "invalidInstallments"
  | "invalidFrequency"
  | "invalidInterval"
  | "invalidEndDate"
  | "invalidOccurrences"
  | "categoryRequired"
  | "invalidUiMode"
  | "invalidQuantity"
  | "wrongPassword";

export const error = (message: ValidationError) => ({ message });

export type FieldErrors = Partial<Record<string, ValidationError>>;

/** Flattens a Zod error into the first message per field. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    result[field] ??= issue.message as ValidationError;
  }
  return result;
}
