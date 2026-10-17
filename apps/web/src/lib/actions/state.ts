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
};

export const initialFormState: FormState = { status: "idle" };

/** Maps Supabase Auth error codes to translated messages. */
export function authErrorCode(code: string | undefined): ErrorCode {
  switch (code) {
    case "invalid_credentials":
      return "invalidCredentials";
    case "email_not_confirmed":
      return "emailNotConfirmed";
    case "weak_password":
      return "weakPassword";
    case "same_password":
      return "samePassword";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "rateLimited";
    default:
      return "unknown";
  }
}
