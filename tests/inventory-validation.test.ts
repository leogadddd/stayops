import { describe, expect, it } from "vitest";

import { isValidMonth, monthNightRange, shiftMonth } from "@/lib/dates";
import {
  isValidHmTime,
  isValidTimeZone,
  propertyInputSchema,
  unitBlockInputSchema,
  unitInputSchema,
} from "@/server/inventory/validation";

describe("propertyInputSchema", () => {
  const valid = {
    name: "Riverside Residences",
    address: "123 Demo St, Manila",
    timezone: "Asia/Manila",
    checkInTime: "15:00",
    checkOutTime: "11:00",
    houseRules: "No smoking.",
  };

  it("accepts a complete property", () => {
    expect(propertyInputSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts empty optional fields", () => {
    expect(
      propertyInputSchema.safeParse({
        ...valid,
        address: "",
        houseRules: "",
      }).success,
    ).toBe(true);
  });

  it("rejects a one-character name", () => {
    expect(propertyInputSchema.safeParse({ ...valid, name: "A" }).success).toBe(
      false,
    );
  });

  it("rejects an invalid timezone", () => {
    expect(
      propertyInputSchema.safeParse({ ...valid, timezone: "Mars/Olympus" })
        .success,
    ).toBe(false);
  });

  it("rejects check-in/out times outside HH:MM", () => {
    expect(
      propertyInputSchema.safeParse({ ...valid, checkInTime: "3pm" }).success,
    ).toBe(false);
    expect(
      propertyInputSchema.safeParse({ ...valid, checkOutTime: "25:00" })
        .success,
    ).toBe(false);
  });
});

describe("unitInputSchema", () => {
  const valid = {
    name: "Unit 12B — Studio",
    capacity: 2,
    bedrooms: 0,
    bathrooms: 1,
    defaultNightlyRateCents: 550000,
    cleaningFeeCents: 50000,
    securityDepositCents: 200000,
    status: "active",
  };

  it("accepts a complete unit", () => {
    expect(unitInputSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts null fees", () => {
    expect(
      unitInputSchema.safeParse({
        ...valid,
        cleaningFeeCents: null,
        securityDepositCents: null,
      }).success,
    ).toBe(true);
  });

  it("rejects a negative rate", () => {
    expect(
      unitInputSchema.safeParse({ ...valid, defaultNightlyRateCents: -1 })
        .success,
    ).toBe(false);
  });

  it("rejects fractional centavos", () => {
    expect(
      unitInputSchema.safeParse({ ...valid, defaultNightlyRateCents: 5500.5 })
        .success,
    ).toBe(false);
  });

  it("rejects a non-listed status", () => {
    expect(unitInputSchema.safeParse({ ...valid, status: "hidden" }).success)
      .toBe(false);
  });

  it("rejects zero capacity", () => {
    expect(unitInputSchema.safeParse({ ...valid, capacity: 0 }).success).toBe(
      false,
    );
  });

  it("rejects bathrooms below a half bath", () => {
    expect(
      unitInputSchema.safeParse({ ...valid, bathrooms: 0.25 }).success,
    ).toBe(false);
  });
});

describe("unitBlockInputSchema", () => {
  it("accepts an end date after the start date", () => {
    expect(
      unitBlockInputSchema.safeParse({
        startDate: "2026-09-05",
        endDate: "2026-09-07",
        reason: "Aircon servicing",
      }).success,
    ).toBe(true);
  });

  it("rejects an end date on or before the start date", () => {
    expect(
      unitBlockInputSchema.safeParse({
        startDate: "2026-09-07",
        endDate: "2026-09-07",
        reason: "Aircon servicing",
      }).success,
    ).toBe(false);
    expect(
      unitBlockInputSchema.safeParse({
        startDate: "2026-09-08",
        endDate: "2026-09-07",
        reason: "Aircon servicing",
      }).success,
    ).toBe(false);
  });

  it("rejects malformed dates", () => {
    expect(
      unitBlockInputSchema.safeParse({
        startDate: "09/05/2026",
        endDate: "2026-09-07",
        reason: "Aircon servicing",
      }).success,
    ).toBe(false);
  });
});

describe("time and timezone helpers", () => {
  it("isValidHmTime accepts 00:00–23:59 only", () => {
    expect(isValidHmTime("00:00")).toBe(true);
    expect(isValidHmTime("23:59")).toBe(true);
    expect(isValidHmTime("24:00")).toBe(false);
    expect(isValidHmTime("12:60")).toBe(false);
    expect(isValidHmTime("noon")).toBe(false);
  });

  it("isValidTimeZone accepts real IANA zones and rejects garbage", () => {
    expect(isValidTimeZone("Asia/Manila")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });
});

describe("month helpers", () => {
  it("isValidMonth accepts yyyy-mm only", () => {
    expect(isValidMonth("2026-09")).toBe(true);
    expect(isValidMonth("2026-13")).toBe(false);
    expect(isValidMonth("09/2026")).toBe(false);
  });

  it("shiftMonth moves across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-09", 0)).toBe("2026-09");
  });

  it("monthNightRange covers the month's nights, half-open", () => {
    const { start, end } = monthNightRange("2026-02");
    expect(start).toBe("2026-02-01");
    expect(end).toBe("2026-03-01");
  });

  it("monthNightRange handles leap years", () => {
    const { start, end } = monthNightRange("2024-02");
    expect(start).toBe("2024-02-01");
    expect(end).toBe("2024-03-01");
  });
});
