import { describe, expect, it } from "vitest";
import { profileSchema, signUpSchema, updatePasswordSchema } from "./auth";
import { fieldErrors } from "./validation";

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
        uiMode: "simple",
      }),
    ).toEqual({
      displayName: null,
      locale: "en",
      baseCurrency: "USD",
      uiMode: "simple",
    });
  });

  it("rejects unsupported locales, currencies and interface modes", () => {
    const result = profileSchema.safeParse({
      displayName: "",
      locale: "de",
      baseCurrency: "JPY",
      uiMode: "expert",
    });
    expect(fieldErrors(result.error!)).toEqual({
      locale: "invalidLocale",
      baseCurrency: "invalidCurrency",
      uiMode: "invalidUiMode",
    });
  });
});
