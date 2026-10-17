import { describe, expect, it } from "vitest";
import {
  balancesAt,
  bucketIndex,
  bucketsFor,
  changePercent,
  periodRange,
  previousRange,
} from "./reports";

const today = "2026-10-17";

describe("periodRange", () => {
  it("covers whole months", () => {
    expect(periodRange("thisMonth", today)).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(periodRange("lastMonth", today)).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(periodRange("3m", today)).toEqual({
      from: "2026-08-01",
      to: "2026-10-31",
    });
    expect(periodRange("12m", today)).toEqual({
      from: "2025-11-01",
      to: "2026-10-31",
    });
    expect(periodRange("thisYear", today)).toEqual({
      from: "2026-01-01",
      to: "2026-12-31",
    });
    expect(periodRange("lastYear", today)).toEqual({
      from: "2025-01-01",
      to: "2025-12-31",
    });
    expect(periodRange("lastMonth", "2026-03-30")).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });

  it("finds the period before", () => {
    expect(previousRange("2026-08-01", "2026-10-31")).toEqual({
      from: "2026-05-01",
      to: "2026-07-31",
    });
    expect(previousRange("2026-01-01", "2026-01-31")).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });
});

describe("bucketsFor", () => {
  it("uses days within a month and months otherwise", () => {
    const days = bucketsFor("2026-02-01", "2026-02-28");
    expect(days.granularity).toBe("day");
    expect(days.buckets).toHaveLength(28);
    const months = bucketsFor("2025-11-01", "2026-10-31");
    expect(months.granularity).toBe("month");
    expect(months.buckets.map((b) => b.start)).toHaveLength(12);
    expect(months.buckets[0]).toEqual({
      start: "2025-11-01",
      end: "2025-11-30",
    });
    expect(bucketIndex(months.buckets, "2026-02-14")).toBe(3);
    expect(bucketIndex(months.buckets, "2026-11-01")).toBe(-1);
  });
});

describe("balancesAt", () => {
  it("adds up flows and leaves out accounts that did not exist yet", () => {
    const result = balancesAt(
      [
        { id: "bank", openingBalance: 1000, openedOn: "2026-09-10" },
        { id: "card", openingBalance: 0, openedOn: "2026-10-05" },
      ],
      [
        { accountId: "bank", on: "2026-09-01", delta: 500 },
        { accountId: "bank", on: "2026-10-02", delta: -200 },
        { accountId: "card", on: "2026-10-06", delta: -300 },
      ],
      ["2026-08-31", "2026-09-30", "2026-10-05", "2026-10-31"],
    );
    // The bank's first transaction is earlier than the day it was added.
    expect(result.get("bank")).toEqual([null, 1500, 1300, 1300]);
    expect(result.get("card")).toEqual([null, null, 0, -300]);
  });
});

describe("changePercent", () => {
  it("compares with the previous value", () => {
    expect(changePercent(150, 100)).toBe(50);
    expect(changePercent(50, 100)).toBe(-50);
    expect(changePercent(10, 0)).toBeNull();
  });
});
