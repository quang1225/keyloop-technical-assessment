import { describe, expect, it } from "vitest";
import {
  bayUtilization,
  formatDayHeading,
  formatSlotLabel,
  isSlotFree,
  isWeekday,
  nearbyWeekdays,
  nextFreeSlot,
  shiftDate,
} from "./slots";

describe("isSlotFree", () => {
  const freeSlots = ["2026-07-15T08:00:00+01:00", "2026-07-15T08:30:00+01:00"];

  it("returns true when the slot is in the free list", () => {
    expect(isSlotFree("2026-07-15T08:00:00+01:00", freeSlots)).toBe(true);
  });

  it("returns false when the slot is not in the free list", () => {
    expect(isSlotFree("2026-07-15T09:00:00+01:00", freeSlots)).toBe(false);
  });

  it("returns false for an empty free list", () => {
    expect(isSlotFree("2026-07-15T08:00:00+01:00", [])).toBe(false);
  });
});

describe("formatSlotLabel", () => {
  it("formats an ISO string as a 24-hour HH:mm label in the given time zone", () => {
    expect(formatSlotLabel("2026-07-15T08:00:00+01:00", "Europe/London")).toBe("08:00");
  });

  it("defaults to the Europe/London time zone", () => {
    expect(formatSlotLabel("2026-07-15T13:30:00+01:00")).toBe("13:30");
  });
});

describe("shiftDate", () => {
  it("moves forward and backward by day", () => {
    expect(shiftDate("2026-07-15", 1)).toBe("2026-07-16");
    expect(shiftDate("2026-07-15", -1)).toBe("2026-07-14");
  });
});

describe("weekday helpers", () => {
  it("detects weekdays", () => {
    expect(isWeekday("2026-07-15")).toBe(true); // Wed
    expect(isWeekday("2026-07-18")).toBe(false); // Sat
  });

  it("lists nearby weekdays from a pivot", () => {
    expect(nearbyWeekdays("2026-07-15", 3)).toEqual([
      "2026-07-15",
      "2026-07-16",
      "2026-07-17",
    ]);
  });

  it("formats a short day heading", () => {
    expect(formatDayHeading("2026-07-15")).toMatch(/Wed/);
  });
});

describe("bayUtilization", () => {
  it("returns 0 for an empty day", () => {
    expect(bayUtilization([])).toBe(0);
  });

  it("computes occupancy for a 60-minute booking in a 9-hour day", () => {
    // 08:00–09:00 = 60 / 540 ≈ 0.111
    const value = bayUtilization([
      { starts_at: "2026-07-15T08:00:00+01:00", ends_at: "2026-07-15T09:00:00+01:00" },
    ]);
    expect(value).toBeCloseTo(60 / 540, 3);
  });
});

describe("nextFreeSlot", () => {
  const slots = ["a", "b", "c"];

  it("starts at ends when nothing selected", () => {
    expect(nextFreeSlot(null, slots, 1)).toBe("a");
    expect(nextFreeSlot(null, slots, -1)).toBe("c");
  });

  it("cycles forward and wraps", () => {
    expect(nextFreeSlot("a", slots, 1)).toBe("b");
    expect(nextFreeSlot("c", slots, 1)).toBe("a");
  });
});
