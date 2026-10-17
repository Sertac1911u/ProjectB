import { afterEach, describe, expect, it, vi } from "vitest";
import { authErrorCode } from "./state";

describe("authErrorCode", () => {
  afterEach(() => vi.restoreAllMocks());

  it("maps known Supabase codes without logging", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      authErrorCode(
        { code: "email_address_not_authorized", message: "x" },
        "signUp",
      ),
    ).toBe("emailNotAuthorized");
    expect(log).not.toHaveBeenCalled();
  });

  it("logs unexpected errors so they can be diagnosed", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      authErrorCode(
        {
          code: "unexpected_failure",
          status: 500,
          message: "Database error saving new user",
        },
        "signUp",
      ),
    ).toBe("unknown");
    expect(log).toHaveBeenCalledWith(
      "[auth] signUp failed (unexpected_failure): Database error saving new user",
    );
  });
});
