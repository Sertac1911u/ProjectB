import { describe, expect, it } from "vitest";
import {
  firstOccurrenceAfter,
  isWithinSchedule,
  occurrenceDate,
  upcomingOccurrences,
} from "./recurring";

describe("occurrenceDate", () => {
  it("keeps monthly schedules on the start day, clamping short months", () => {
    const rent = {
      startOn: "2026-01-31",
      frequency: "monthly",
      interval: 1,
    } as const;
    expect([0, 1, 2, 3, 12].map((k) => occurrenceDate(rent, k))).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2027-01-31",
    ]);
  });

  it("supports weekly, every-N and yearly schedules", () => {
    expect(
      occurrenceDate(
        { startOn: "2026-12-28", frequency: "weekly", interval: 1 },
        1,
      ),
    ).toBe("2027-01-04");
    expect(
      occurrenceDate(
        { startOn: "2026-01-15", frequency: "weekly", interval: 2 },
        3,
      ),
    ).toBe("2026-02-26");
    expect(
      occurrenceDate(
        { startOn: "2026-01-15", frequency: "monthly", interval: 3 },
        2,
      ),
    ).toBe("2026-07-15");
    expect(
      occurrenceDate(
        { startOn: "2028-02-29", frequency: "yearly", interval: 1 },
        1,
      ),
    ).toBe("2029-02-28");
  });
});

describe("schedule limits", () => {
  const base = {
    startOn: "2026-01-01",
    frequency: "monthly",
    interval: 1,
  } as const;

  it("ends after a number of occurrences or on a date", () => {
    expect(isWithinSchedule({ ...base, maxOccurrences: 3 }, 2)).toBe(true);
    expect(isWithinSchedule({ ...base, maxOccurrences: 3 }, 3)).toBe(false);
    expect(isWithinSchedule({ ...base, endOn: "2026-03-01" }, 2)).toBe(true);
    expect(isWithinSchedule({ ...base, endOn: "2026-02-28" }, 2)).toBe(false);
  });

  it("finds where to continue after a day", () => {
    expect(firstOccurrenceAfter(base, "2026-03-15")).toBe(3);
    expect(firstOccurrenceAfter(base, "2025-12-31")).toBe(0);
    expect(
      firstOccurrenceAfter({ ...base, maxOccurrences: 2 }, "2026-03-15"),
    ).toBeNull();
  });

  it("lists upcoming dates", () => {
    expect(upcomingOccurrences({ ...base, maxOccurrences: 4 }, 2, 5)).toEqual([
      "2026-03-01",
      "2026-04-01",
    ]);
  });
});
