import { describe, it, expect } from "vitest";
import { bucketByDay, bucketAmountByDay } from "@/lib/analytics";

const FIXED_NOW = new Date("2026-07-18T12:00:00.000Z");

describe("bucketByDay", () => {
  it("returns exactly `days` buckets, oldest first, ending at today", () => {
    const result = bucketByDay([], 7, FIXED_NOW);
    expect(result).toHaveLength(7);
    expect(result[result.length - 1].date).toBe("07-18");
    expect(result[0].date).toBe("07-12");
  });

  it("counts events landing on the correct day", () => {
    const timestamps = [
      "2026-07-18T08:00:00.000Z",
      "2026-07-18T20:00:00.000Z",
      "2026-07-17T00:00:00.000Z",
    ];
    const result = bucketByDay(timestamps, 7, FIXED_NOW);
    const today = result.find((r) => r.date === "07-18");
    const yesterday = result.find((r) => r.date === "07-17");
    expect(today?.value).toBe(2);
    expect(yesterday?.value).toBe(1);
  });

  it("fills days with zero events rather than omitting them", () => {
    const result = bucketByDay(["2026-07-18T00:00:00.000Z"], 7, FIXED_NOW);
    const zeroDays = result.filter((r) => r.value === 0);
    expect(zeroDays.length).toBe(6);
  });

  it("ignores events outside the requested window", () => {
    const tooOld = "2026-06-01T00:00:00.000Z";
    const result = bucketByDay([tooOld], 7, FIXED_NOW);
    const total = result.reduce((s, r) => s + r.value, 0);
    expect(total).toBe(0);
  });

  it("ignores null, undefined, and invalid timestamps without throwing", () => {
    expect(() => bucketByDay([null, undefined, "not-a-date"], 7, FIXED_NOW)).not.toThrow();
    const result = bucketByDay([null, undefined, "not-a-date"], 7, FIXED_NOW);
    expect(result.reduce((s, r) => s + r.value, 0)).toBe(0);
  });
});

describe("bucketAmountByDay", () => {
  it("sums amounts per day rather than counting events", () => {
    const events = [
      { timestamp: "2026-07-18T08:00:00.000Z", amount: 5 },
      { timestamp: "2026-07-18T20:00:00.000Z", amount: 10 },
      { timestamp: "2026-07-17T00:00:00.000Z", amount: 20 },
    ];
    const result = bucketAmountByDay(events, 7, FIXED_NOW);
    const today = result.find((r) => r.date === "07-18");
    const yesterday = result.find((r) => r.date === "07-17");
    expect(today?.value).toBe(15);
    expect(yesterday?.value).toBe(20);
  });

  it("returns all-zero buckets for an empty event list", () => {
    const result = bucketAmountByDay([], 30, FIXED_NOW);
    expect(result).toHaveLength(30);
    expect(result.every((r) => r.value === 0)).toBe(true);
  });
});