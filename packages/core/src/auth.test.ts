import { describe, expect, it } from "vitest";
import {
  fieldErrors,
  profileSchema,
  signUpSchema,
  updatePasswordSchema,
} from "./auth";

describe("signUpSchema", () => {
  it("normalizes the email address", () => {
    const result = signUpSchema.parse({
      email: "  Ali@Example.COM ",
      password: "12345678",
    });
    expect(result.email).toBe("ali@example.com");
  });

  it("reports translation keys per field", () => {
    const result = signUpSchema.safeParse({ email: "nope", password: "123" });
    expect(result.success).toBe(false);
    expect(fieldErrors(result.error!)).toEqual({
      email: "invalidEmail",
      password: "passwordTooShort",
    });
  });
});

describe("updatePasswordSchema", () => {
  it("requires matching passwords", () => {
    const result = updatePasswordSchema.safeParse({
      password: "12345678",
      confirmPassword: "87654321",
    });
    expect(fieldErrors(result.error!)).toEqual({
      confirmPassword: "passwordsDoNotMatch",
    });
  });
});

describe("profileSchema", () => {
  it("turns an empty display name into null", () => {
    expect(
      profileSchema.parse({
        displayName: "  ",
        locale: "en",
        baseCurrency: "USD",
      }),
    ).toEqual({ displayName: null, locale: "en", baseCurrency: "USD" });
  });

  it("rejects unsupported locales and currencies", () => {
    const result = profileSchema.safeParse({
      displayName: "",
      locale: "de",
      baseCurrency: "JPY",
    });
    expect(fieldErrors(result.error!)).toEqual({
      locale: "invalidLocale",
      baseCurrency: "invalidCurrency",
    });
  });
});
