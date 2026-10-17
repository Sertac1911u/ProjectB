import { describe, expect, it } from "vitest";
import { authRedirect, localeOfPath, safeNext } from "./redirects";

describe("authRedirect", () => {
  it("sends signed-out users from app pages to the login page", () => {
    expect(authRedirect("/tr/dashboard", "", false)).toBe(
      "/tr/login?next=%2Ftr%2Fdashboard",
    );
    expect(authRedirect("/en/settings", "?tab=1", false)).toBe(
      "/en/login?next=%2Fen%2Fsettings%3Ftab%3D1",
    );
    expect(authRedirect("/tr/recurring/new", "", false)).toBe(
      "/tr/login?next=%2Ftr%2Frecurring%2Fnew",
    );
  });

  it("sends signed-in users away from guest pages", () => {
    expect(authRedirect("/en/login", "", true)).toBe("/en/dashboard");
    expect(authRedirect("/tr/signup", "", true)).toBe("/tr/dashboard");
  });

  it("lets other requests through", () => {
    expect(authRedirect("/tr", "", false)).toBeNull();
    expect(authRedirect("/tr/login", "", false)).toBeNull();
    expect(authRedirect("/tr/dashboard", "", true)).toBeNull();
    expect(authRedirect("/tr/dashboardx", "", false)).toBeNull();
    // Paths without a locale are redirected by next-intl first.
    expect(authRedirect("/dashboard", "", false)).toBeNull();
  });
});

describe("safeNext", () => {
  it("allows relative paths", () => {
    expect(safeNext("/en/settings?x=1", "/fallback")).toBe("/en/settings?x=1");
  });

  it.each([
    null,
    "",
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "dashboard",
  ])("rejects %j", (value) => {
    expect(safeNext(value, "/fallback")).toBe("/fallback");
  });
});

describe("localeOfPath", () => {
  it("reads the locale prefix", () => {
    expect(localeOfPath("/en/dashboard")).toBe("en");
    expect(localeOfPath("/de/dashboard")).toBeUndefined();
  });
});
