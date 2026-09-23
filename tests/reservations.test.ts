import { describe, expect, it } from "vitest";
import {
  buildDefaultCharges,
  computeTotals,
} from "@/lib/charges";
import {
  ALLOWED_TRANSITIONS,
  chargeLineSchema,
  createConfirmedSchema,
  createHoldSchema,
  guestInputSchema,
  isAllowedTransition,
} from "@/server/reservations/validation";
import {
  buildNightStatusMap,
  checkIntervalAvailability,
  type OccupancySegment,
} from "@/server/inventory/availability";

const hold = (
  startDate: string,
  endDate: string,
  guestName = "Maria Santos",
): OccupancySegment => ({
  kind: "reservation",
  id: `hold-${startDate}`,
  startDate,
  endDate,
  status: "hold",
  guestName,
  expiresAt: null,
});

const booking = (
  startDate: string,
  endDate: string,
  guestName = "Juan Reyes",
): OccupancySegment => ({
  kind: "reservation",
  id: `booking-${startDate}`,
  startDate,
  endDate,
  status: "confirmed",
  guestName,
  expiresAt: null,
});

const block = (startDate: string, endDate: string): OccupancySegment => ({
  kind: "block",
  id: `block-${startDate}`,
  startDate,
  endDate,
  reason: "AC repair",
});

describe("buildDefaultCharges", () => {
  it("builds an accommodation line for the requested nights", () => {
    const lines = buildDefaultCharges({
      nightlyRateCents: 550_000,
      cleaningFeeCents: 50_000,
      securityDepositCents: 200_000,
      nights: 3,
    });
    expect(lines).toEqual([
      {
        type: "accommodation",
        description: "Accommodation (3 nights)",
        quantity: 3,
        unitAmountCents: 550_000,
      },
      {
        type: "cleaning",
        description: "Cleaning fee",
        quantity: 1,
        unitAmountCents: 50_000,
      },
      {
        type: "security_deposit",
        description: "Refundable security deposit",
        quantity: 1,
        unitAmountCents: 200_000,
      },
    ]);
  });

  it("uses the singular night label and skips null fees", () => {
    const lines = buildDefaultCharges({
      nightlyRateCents: 550_000,
      cleaningFeeCents: null,
      securityDepositCents: null,
      nights: 1,
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]?.description).toBe("Accommodation (1 night)");
  });
});

describe("computeTotals", () => {
  it("excludes refundable deposits from the booking total", () => {
    const { bookingTotalCents, depositTotalCents } = computeTotals(
      buildDefaultCharges({
        nightlyRateCents: 550_000,
        cleaningFeeCents: 50_000,
        securityDepositCents: 200_000,
        nights: 2,
      }),
    );
    expect(bookingTotalCents).toBe(2 * 550_000 + 50_000);
    expect(depositTotalCents).toBe(200_000);
  });

  it("lets a negative discount reduce the booking total", () => {
    const { bookingTotalCents, depositTotalCents } = computeTotals([
      {
        type: "accommodation",
        description: "Accommodation (2 nights)",
        quantity: 2,
        unitAmountCents: 550_000,
      },
      {
        type: "discount",
        description: "Repeat-guest discount",
        quantity: 1,
        unitAmountCents: -100_000,
      },
    ]);
    expect(bookingTotalCents).toBe(1_000_000);
    expect(depositTotalCents).toBe(0);
  });
});

describe("ALLOWED_TRANSITIONS", () => {
  it("allows a hold to be confirmed, cancelled or expired", () => {
    expect(isAllowedTransition("hold", "confirmed")).toBe(true);
    expect(isAllowedTransition("hold", "cancelled")).toBe(true);
    expect(isAllowedTransition("hold", "expired")).toBe(true);
  });

  it("never moves backwards (confirmed cannot return to hold)", () => {
    expect(isAllowedTransition("confirmed", "hold")).toBe(false);
  });

  it("walks the stay forward and then stops", () => {
    expect(isAllowedTransition("confirmed", "checked_in")).toBe(true);
    expect(isAllowedTransition("checked_in", "checked_out")).toBe(true);
    expect(ALLOWED_TRANSITIONS.checked_out).toHaveLength(0);
    expect(ALLOWED_TRANSITIONS.cancelled).toHaveLength(0);
    expect(ALLOWED_TRANSITIONS.expired).toHaveLength(0);
  });
});

describe("buildNightStatusMap with reservation segments", () => {
  it("marks nights under a live hold as held", () => {
    const map = buildNightStatusMap("2026-09-04", "2026-09-09", [
      hold("2026-09-05", "2026-09-08"),
    ]);
    expect(map.get("2026-09-04")).toEqual({ kind: "available" });
    expect(map.get("2026-09-05")).toEqual({
      kind: "held",
      guestName: "Maria Santos",
      expiresAt: null,
      segmentId: "hold-2026-09-05",
    });
    expect(map.get("2026-09-07")).toMatchObject({ kind: "held" });
    // Check-out day is free again.
    expect(map.get("2026-09-08")).toEqual({ kind: "available" });
  });

  it("marks nights under a confirmed booking as booked", () => {
    const map = buildNightStatusMap("2026-09-01", "2026-09-06", [
      booking("2026-09-02", "2026-09-04"),
    ]);
    expect(map.get("2026-09-02")).toEqual({
      kind: "booked",
      guestName: "Juan Reyes",
      status: "confirmed",
      segmentId: "booking-2026-09-02",
    });
    expect(map.get("2026-09-03")).toMatchObject({ kind: "booked" });
    expect(map.get("2026-09-04")).toEqual({ kind: "available" });
  });

  it("lets the earliest starting segment win across kinds", () => {
    const map = buildNightStatusMap("2026-09-01", "2026-09-07", [
      booking("2026-09-03", "2026-09-06"),
      block("2026-09-02", "2026-09-05"),
    ]);
    expect(map.get("2026-09-02")).toMatchObject({ kind: "blocked" });
    // The block started first, so it wins the contested nights.
    expect(map.get("2026-09-03")).toMatchObject({
      kind: "blocked",
      reason: "AC repair",
    });
  });
});

describe("checkIntervalAvailability against reservations", () => {
  it("names the hold guest in the conflict reason", () => {
    const check = checkIntervalAvailability(
      [hold("2026-09-05", "2026-09-08", "Maria Santos")],
      "2026-09-06",
      "2026-09-10",
    );
    expect(check.available).toBe(false);
    if (!check.available) {
      expect(check.conflict.reason).toBe("Hold for Maria Santos");
      expect(check.conflict.startDate).toBe("2026-09-05");
      expect(check.conflict.endDate).toBe("2026-09-08");
    }
  });

  it("names the booking guest once confirmed", () => {
    const check = checkIntervalAvailability(
      [booking("2026-09-05", "2026-09-08", "Juan Reyes")],
      "2026-09-04",
      "2026-09-06",
    );
    expect(check.available).toBe(false);
    if (!check.available) {
      expect(check.conflict.reason).toBe("Booking for Juan Reyes");
    }
  });
});

describe("reservation input schemas", () => {
  const base = {
    unitId: "3f8b0d7e-7d2b-4c6a-9a9a-2f4e6b8a1c3d",
    checkIn: "2026-10-02",
    checkOut: "2026-10-05",
    guestCount: 2,
    charges: [
      {
        type: "accommodation",
        description: "Accommodation (3 nights)",
        quantity: 3,
        unitAmountCents: 550_000,
      },
    ],
  };

  it("accepts a valid hold and defaults to 24 hours", () => {
    const parsed = createHoldSchema.parse({ ...base });
    expect(parsed.holdMinutes).toBe(1440);
  });

  it("rejects a hold range where checkout is not after check-in", () => {
    const result = createHoldSchema.safeParse({
      ...base,
      checkOut: base.checkIn,
    });
    expect(result.success).toBe(false);
  });

  it("enforces hold duration bounds", () => {
    expect(
      createHoldSchema.safeParse({ ...base, holdMinutes: 4 }).success,
    ).toBe(false);
    expect(
      createHoldSchema.safeParse({ ...base, holdMinutes: 1441 }).success,
    ).toBe(false);
    expect(
      createHoldSchema.safeParse({ ...base, holdMinutes: 5 }).success,
    ).toBe(true);
  });

  it("defaults acknowledgeUnpaid to false on confirmed reservations", () => {
    const parsed = createConfirmedSchema.parse({ ...base });
    expect(parsed.acknowledgeUnpaid).toBe(false);
  });

  it("requires a contact method on the guest", () => {
    expect(
      guestInputSchema.safeParse({ name: "Maria Santos" }).success,
    ).toBe(false);
    expect(
      guestInputSchema.safeParse({ name: "Maria Santos", phone: "0917 555 0100" })
        .success,
    ).toBe(true);
    expect(
      guestInputSchema.safeParse({
        name: "Maria Santos",
        email: "maria@example.com",
      }).success,
    ).toBe(true);
  });

  it("forces discounts to be negative and other lines non-negative", () => {
    expect(
      chargeLineSchema.safeParse({
        type: "discount",
        description: "Repeat-guest discount",
        quantity: 1,
        unitAmountCents: 100_000,
      }).success,
    ).toBe(false);
    expect(
      chargeLineSchema.safeParse({
        type: "discount",
        description: "Repeat-guest discount",
        quantity: 1,
        unitAmountCents: -100_000,
      }).success,
    ).toBe(true);
    expect(
      chargeLineSchema.safeParse({
        type: "accommodation",
        description: "Nightly rate",
        quantity: 1,
        unitAmountCents: -100_000,
      }).success,
    ).toBe(false);
  });
});
