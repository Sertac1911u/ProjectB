import type { FieldErrors } from "@projectb/core";
import type { Messages } from "next-intl";

export type ErrorCode = keyof Messages["Errors"];

/** What a form's Server Action reports back to the form. */
export type FormState = {
  status: "idle" | "error" | "success";
  error?: ErrorCode;
  fieldErrors?: FieldErrors;
  /** Submitted values to show again after a failed attempt (never passwords). */
  values?: Record<string, string>;
  /**
   * Differs on every response. Forms use it as their React key, so they
   * remount (and refocus) even when two responses are otherwise identical.
   */
  nonce?: string;
};

/** Stamps a response with a fresh nonce; see FormState.nonce. */
export function respond<S extends FormState>(state: S): S {
  return { ...state, nonce: crypto.randomUUID() };
}

export const initialFormState: FormState = { status: "idle" };

const AUTH_ERRORS: Record<string, ErrorCode> = {
  invalid_credentials: "invalidCredentials",
  email_not_confirmed: "emailNotConfirmed",
  weak_password: "weakPassword",
  same_password: "samePassword",
  over_request_rate_limit: "rateLimited",
  over_email_send_rate_limit: "rateLimited",
  email_address_invalid: "emailRejected",
  email_address_not_authorized: "emailNotAuthorized",
  signup_disabled: "signupDisabled",
  user_already_exists: "userAlreadyExists",
  email_exists: "userAlreadyExists",
};

/**
 * Maps a Supabase Auth error to a translated message. Unexpected errors are
 * logged to the server console, since the user only sees a generic message.
 */
export function authErrorCode(
  error: { code?: string; status?: number; message: string },
  action: string,
): ErrorCode {
  const known = error.code ? AUTH_ERRORS[error.code] : undefined;
  if (known) return known;
  console.error(
    `[auth] ${action} failed (${error.code ?? error.status ?? "no code"}): ${error.message}`,
  );
  return "unknown";
}
