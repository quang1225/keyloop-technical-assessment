import { describe, expect, it } from "vitest";
import { formatSlotLabel, isSlotFree } from "./slots";

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
