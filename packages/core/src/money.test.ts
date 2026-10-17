import { describe, expect, it } from "vitest";
import { formatMoney, parseMoney } from "./money";

const normalizeSpaces = (s: string) => s.replace(/\s/g, " ");

describe("formatMoney", () => {
  it("formats minor units in Turkish notation", () => {
    expect(normalizeSpaces(formatMoney(123456, "TRY", "tr-TR"))).toBe(
      "₺1.234,56",
    );
  });

  it("formats minor units in English notation", () => {
    expect(formatMoney(123456, "USD", "en-US")).toBe("$1,234.56");
  });

  it("formats negative amounts", () => {
    expect(formatMoney(-50, "EUR", "en-US")).toBe("-€0.50");
  });

  it("rejects non-integer amounts", () => {
    expect(() => formatMoney(12.5, "TRY", "tr-TR")).toThrow(RangeError);
  });
});

describe("parseMoney", () => {
  it.each([
    ["1.234,56", 123456],
    ["1234,56", 123456],
    ["12,5", 1250],
    ["12", 1200],
    ["0,01", 1],
    ["12,", 1200],
    ["-45,90", -4590],
    ["  1.000  ", 100000],
  ])("parses Turkish input %j", (input, expected) => {
    expect(parseMoney(input, "TRY", "tr-TR")).toBe(expected);
  });

  it.each([
    ["1,234.56", 123456],
    ["1234.56", 123456],
    ["12.5", 1250],
  ])("parses English input %j", (input, expected) => {
    expect(parseMoney(input, "USD", "en-US")).toBe(expected);
  });

  it.each(["", "abc", "1,2,3", "12,345", "1.23.4,5", ",5", "1.2345,00"])(
    "rejects invalid Turkish input %j",
    (input) => {
      expect(parseMoney(input, "TRY", "tr-TR")).toBeNull();
    },
  );
});
