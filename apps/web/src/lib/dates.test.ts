import { describe, expect, it } from "vitest";
import {
  daysBetween,
  formatDay,
  formatMonth,
  monthRange,
  parseMonthParam,
  today,
} from "./dates";

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

describe("daysBetween", () => {
  it("counts calendar days across months", () => {
    expect(daysBetween("2026-10-17", "2026-10-25")).toBe(8);
    expect(daysBetween("2026-10-25", "2026-10-17")).toBe(-8);
    expect(daysBetween("2026-02-27", "2026-03-01")).toBe(2);
  });
});

describe("months", () => {
  it("formats and parses months", () => {
    expect(formatMonth("2026-10-17", "tr")).toBe("Ekim 2026");
    expect(formatMonth("2026-01-01", "en")).toBe("January 2026");
    expect(parseMonthParam("2026-10")).toBe("2026-10-01");
    expect(parseMonthParam("2026-10-01")).toBe("2026-10-01");
    for (const bad of [
      "2026-13",
      "2026-10-17",
      "abc",
      undefined,
      ["2026-10"],
    ]) {
      expect(parseMonthParam(bad)).toBeNull();
    }
  });
});
