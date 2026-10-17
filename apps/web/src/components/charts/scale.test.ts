import { describe, expect, it } from "vitest";
import { compactMoney, niceTicks } from "./scale";

describe("chart scales", () => {
  it("rounds ticks to clean steps", () => {
    expect(niceTicks(0, 3_000_000)).toEqual([
      0, 1_000_000, 2_000_000, 3_000_000,
    ]);
    expect(niceTicks(0, 0)).toEqual([0, 1]);
    expect(niceTicks(-500, 1500)).toEqual([-500, 0, 500, 1000, 1500]);
  });

  it("keeps the currency symbol where the locale puts it", () => {
    // Intl separates "10" and "B" with a non-breaking space.
    expect(compactMoney(1_000_000, "TRY", "tr")).toBe("₺10\u00a0B");
    expect(compactMoney(150_000, "USD", "en")).toBe("$1.5K");
    expect(compactMoney(-500_000, "TRY", "tr")).toBe("-₺5\u00a0B");
    expect(compactMoney(0, "TRY", "tr")).toBe("₺0");
  });
});
