import { describe, expect, it } from "vitest";
import { formatDay, monthRange, today } from "./dates";

describe("dates", () => {
  it("uses the given time zone for today", () => {
    // 22:30 UTC on 31 Oct is already 1 Nov in Istanbul (UTC+3).
    const now = new Date("2026-10-31T22:30:00Z");
    expect(today("Europe/Istanbul", now)).toBe("2026-11-01");
    expect(today("UTC", now)).toBe("2026-10-31");
  });

  it("finds month boundaries, including leap years", () => {
    expect(monthRange("2026-10-17")).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(monthRange("2028-02-10")).toEqual({
      from: "2028-02-01",
      to: "2028-02-29",
    });
  });

  it("formats calendar dates without a time zone shift", () => {
    expect(formatDay("2026-10-01", "tr")).toBe("1 Ekim 2026");
    expect(formatDay("2026-10-01", "en")).toBe("October 1, 2026");
  });
});
