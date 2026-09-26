import { describe, expect, it } from "vitest";
import { buildDefaultCharges } from "@/lib/charges";
import { accommodationLines, accommodationTotal, dayRateSummary, effectiveDayRates, nightlyRateFor } from "@/lib/rates";
import { stayLengthHours, stayLengthLabel } from "@/lib/stay-times";

// 2026-10-09 is a Friday.
const weekend = { "5": 700_000, "6": 700_000 } as const;
const peso = (cents: number) => `₱${cents / 100}`;

describe("day rates", () => {
  it("prices a night by the day it starts", () => {
    expect(nightlyRateFor("2026-10-09", 550_000, weekend)).toBe(700_000); // Fri
    expect(nightlyRateFor("2026-10-11", 550_000, weekend)).toBe(550_000); // Sun
  });

  it("splits a stay into one accommodation line per rate", () => {
    // Thu, Fri, Sat, Sun nights.
    const lines = accommodationLines({ checkIn: "2026-10-08", nights: 4, baseCents: 550_000, dayRates: weekend });
    expect(lines).toEqual([
      { description: "Accommodation · Thu, Sun (2 nights)", quantity: 2, unitAmountCents: 550_000 },
      { description: "Accommodation · Fri, Sat (2 nights)", quantity: 2, unitAmountCents: 700_000 },
    ]);
    expect(accommodationTotal({ checkIn: "2026-10-08", nights: 4, baseCents: 550_000, dayRates: weekend })).toBe(2_500_000);
  });

  it("keeps the single classic line when every night has the same rate", () => {
    expect(accommodationLines({ checkIn: "2026-10-12", nights: 2, baseCents: 550_000, dayRates: weekend })).toEqual([
      { description: "Accommodation (2 nights)", quantity: 2, unitAmountCents: 550_000 },
    ]);
    // A weekend-only stay is one line too, at the weekend rate.
    expect(accommodationLines({ checkIn: "2026-10-09", nights: 2, baseCents: 550_000, dayRates: weekend })).toEqual([
      { description: "Accommodation (2 nights)", quantity: 2, unitAmountCents: 700_000 },
    ]);
  });

  it("builds default charges with day rates when a check-in is given", () => {
    const lines = buildDefaultCharges({
      nightlyRateCents: 550_000, dayRates: weekend, checkIn: "2026-10-08", nights: 2,
      cleaningFeeCents: 50_000, securityDepositCents: null,
    });
    expect(lines.map((line) => [line.type, line.quantity, line.unitAmountCents])).toEqual([
      ["accommodation", 1, 550_000],
      ["accommodation", 1, 700_000],
      ["cleaning", 1, 50_000],
    ]);
  });

  it("ignores day rates equal to the regular rate and summarises the rest", () => {
    expect(effectiveDayRates(550_000, { "1": 550_000, "5": 700_000 })).toEqual({ "5": 700_000 });
    expect(dayRateSummary(550_000, { "0": 600_000, "5": 700_000, "6": 700_000 }, peso)).toEqual(["Fri, Sat ₱7000", "Sun ₱6000"]);
  });
});

describe("stay length", () => {
  it("is the gap from check-in to next-day check-out", () => {
    expect(stayLengthHours("14:00", "12:00")).toBe(22);
    expect(stayLengthHours("15:00", "11:00")).toBe(20);
    expect(stayLengthHours("14:00", "14:00")).toBe(24);
    expect(stayLengthHours("14:00", "02:30")).toBe(12.5);
    expect(stayLengthLabel(22)).toBe("22-hour stay");
  });
});
