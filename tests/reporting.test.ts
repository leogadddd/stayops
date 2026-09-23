import { describe, expect, it } from "vitest";
import {
  computeReport,
  type ReportComputationInput,
} from "@/lib/reporting";

const PROPERTY_A = "11111111-1111-1111-1111-111111111111";
const PROPERTY_B = "22222222-2222-2222-2222-222222222222";
const UNIT_1 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const UNIT_2 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const UNIT_3 = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const STAY_1 = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const STAY_2 = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

function baseInput(overrides: Partial<ReportComputationInput> = {}) {
  return {
    from: "2026-09-01",
    to: "2026-10-01",
    units: [
      { id: UNIT_1, propertyId: PROPERTY_A, status: "active" as const },
      { id: UNIT_2, propertyId: PROPERTY_A, status: "active" as const },
      { id: UNIT_3, propertyId: PROPERTY_B, status: "maintenance" as const },
    ],
    blocks: [],
    stays: [],
    charges: [],
    periodPayments: [],
    periodRefunds: [],
    periodDeductionsCents: 0,
    depositsPosition: {
      collectedCents: 0,
      refundedCents: 0,
      deductedCents: 0,
    },
    periodExpenses: [],
    ...overrides,
  } satisfies ReportComputationInput;
}

describe("computeReport occupancy", () => {
  it("counts occupied nights of real stays against active-unit nights", () => {
    const summary = computeReport(
      baseInput({
        stays: [
          {
            id: STAY_1,
            unitId: UNIT_1,
            propertyId: PROPERTY_A,
            checkInDate: "2026-09-10",
            checkOutDate: "2026-09-14",
            status: "confirmed",
          },
        ],
      }),
    );
    // 30 bookable nights x 2 active units; stay occupies 4 nights.
    expect(summary.bookableNights).toBe(60);
    expect(summary.occupiedNights).toBe(4);
    expect(summary.occupancyRate).toBeCloseTo(4 / 60);
    expect(summary.activeUnitCount).toBe(2);
  });

  it("excludes blocked nights from the bookable denominator", () => {
    const summary = computeReport(
      baseInput({
        blocks: [
          {
            unitId: UNIT_1,
            startDate: "2026-09-05",
            endDate: "2026-09-10",
          },
        ],
      }),
    );
    // UNIT_1 loses 5 nights; UNIT_2 stays full.
    expect(summary.bookableNights).toBe(55);
  });

  it("counts only the in-period portion of a stay crossing the boundary", () => {
    const summary = computeReport(
      baseInput({
        stays: [
          {
            id: STAY_1,
            unitId: UNIT_1,
            propertyId: PROPERTY_A,
            checkInDate: "2026-08-28",
            checkOutDate: "2026-09-03",
            status: "checked_out",
          },
        ],
      }),
    );
    // Only Sep 1 and Sep 2 fall inside the period.
    expect(summary.occupiedNights).toBe(2);
  });

  it("ignores holds, cancelled and expired stays", () => {
    const summary = computeReport(
      baseInput({
        stays: [
          {
            id: STAY_1,
            unitId: UNIT_1,
            propertyId: PROPERTY_A,
            checkInDate: "2026-09-01",
            checkOutDate: "2026-09-05",
            status: "hold",
          },
          {
            id: STAY_2,
            unitId: UNIT_2,
            propertyId: PROPERTY_A,
            checkInDate: "2026-09-01",
            checkOutDate: "2026-09-05",
            status: "cancelled",
          },
        ],
      }),
    );
    expect(summary.occupiedNights).toBe(0);
    expect(summary.occupancyRate).toBe(0);
  });

  it("uses the same eligible nights for both occupancy counts", () => {
    const summary = computeReport(baseInput({
      from: "2026-09-01", to: "2026-09-03",
      units: [
        { id: UNIT_1, propertyId: PROPERTY_A, status: "active" },
        { id: UNIT_2, propertyId: PROPERTY_A, status: "maintenance" },
      ],
      blocks: [{ unitId: UNIT_1, startDate: "2026-09-01", endDate: "2026-09-02" }],
      stays: [UNIT_1, UNIT_2].map((unitId, index) => ({
        id: index === 0 ? STAY_1 : STAY_2, unitId, propertyId: PROPERTY_A,
        checkInDate: "2026-09-01", checkOutDate: "2026-09-03", status: "checked_out",
      })),
    }));
    expect(summary.bookableNights).toBe(1);
    expect(summary.occupiedNights).toBe(1);
    expect(summary.occupancyRate).toBe(1);
  });

  it("returns a null rate when there are no bookable nights", () => {
    const summary = computeReport(
      baseInput({
        units: [
          { id: UNIT_1, propertyId: PROPERTY_A, status: "renovating" },
        ],
      }),
    );
    expect(summary.bookableNights).toBe(0);
    expect(summary.occupancyRate).toBeNull();
  });
});

describe("computeReport booked value", () => {
  it("accrues accommodation per overlap night at the unit rate", () => {
    const summary = computeReport(
      baseInput({
        stays: [
          {
            id: STAY_1,
            unitId: UNIT_1,
            propertyId: PROPERTY_A,
            checkInDate: "2026-08-28",
            checkOutDate: "2026-09-03",
            status: "checked_out",
          },
        ],
        charges: [
          {
            reservationId: STAY_1,
            type: "accommodation",
            quantity: 6,
            unitAmountCents: 250_000,
            isRefundableDeposit: false,
          },
        ],
      }),
    );
    // 2 in-period nights x ₱2,500/night.
    expect(summary.accommodationBookedCents).toBe(500_000);
    expect(summary.bookedValueCents).toBe(500_000);
    expect(summary.avgAccommodationRateCents).toBe(250_000);
  });

  it("allocates edited charge totals over actual nights without losing centavos", () => {
    const input = baseInput({
      from: "2026-09-29", to: "2026-10-03",
      stays: [{
        id: STAY_1, unitId: UNIT_1, propertyId: PROPERTY_A,
        checkInDate: "2026-09-29", checkOutDate: "2026-10-02", status: "checked_out",
      }],
      charges: [{
        reservationId: STAY_1, type: "accommodation", quantity: 4,
        unitAmountCents: 25_001, isRefundableDeposit: false,
      }],
    });
    const whole = computeReport(input);
    const september = computeReport({ ...input, to: "2026-10-01" });
    const october = computeReport({ ...input, from: "2026-10-01" });
    const afterCheckout = computeReport({ ...input, from: "2026-10-02" });
    expect(whole.accommodationBookedCents).toBe(100_004);
    expect(september.accommodationBookedCents).toBe(66_670);
    expect(october.accommodationBookedCents).toBe(33_334);
    expect(september.accommodationBookedCents + october.accommodationBookedCents)
      .toBe(whole.accommodationBookedCents);
    expect(afterCheckout.accommodationBookedCents).toBe(0);
  });

  it("attributes one-time charges to the stay's first night only", () => {
    const cleaningFee = {
      reservationId: STAY_1,
      type: "cleaning" as const,
      quantity: 1,
      unitAmountCents: 800_00,
      isRefundableDeposit: false,
    };
    const inPeriod = computeReport(
      baseInput({
        stays: [
          {
            id: STAY_1,
            unitId: UNIT_1,
            propertyId: PROPERTY_A,
            checkInDate: "2026-09-02",
            checkOutDate: "2026-09-04",
            status: "confirmed",
          },
        ],
        charges: [cleaningFee],
      }),
    );
    expect(inPeriod.oneTimeBookedCents).toBe(800_00);

    const startedBeforePeriod = computeReport(
      baseInput({
        stays: [
          {
            id: STAY_1,
            unitId: UNIT_1,
            propertyId: PROPERTY_A,
            checkInDate: "2026-08-30",
            checkOutDate: "2026-09-04",
            status: "confirmed",
          },
        ],
        charges: [cleaningFee],
      }),
    );
    expect(startedBeforePeriod.oneTimeBookedCents).toBe(0);
    expect(startedBeforePeriod.bookedValueCents).toBe(
      startedBeforePeriod.accommodationBookedCents,
    );
  });

  it("never counts refundable deposits as booked value", () => {
    const summary = computeReport(
      baseInput({
        stays: [
          {
            id: STAY_1,
            unitId: UNIT_1,
            propertyId: PROPERTY_A,
            checkInDate: "2026-09-02",
            checkOutDate: "2026-09-04",
            status: "confirmed",
          },
        ],
        charges: [
          {
            reservationId: STAY_1,
            type: "security_deposit",
            quantity: 1,
            unitAmountCents: 1000_000,
            isRefundableDeposit: true,
          },
        ],
      }),
    );
    expect(summary.bookedValueCents).toBe(0);
  });

  it("splits metrics per property for the breakdown table", () => {
    const summary = computeReport(
      baseInput({
        stays: [
          {
            id: STAY_1,
            unitId: UNIT_1,
            propertyId: PROPERTY_A,
            checkInDate: "2026-09-01",
            checkOutDate: "2026-09-03",
            status: "confirmed",
          },
          {
            id: STAY_2,
            unitId: UNIT_3,
            propertyId: PROPERTY_B,
            checkInDate: "2026-09-01",
            checkOutDate: "2026-09-03",
            status: "confirmed",
          },
        ],
        charges: [
          {
            reservationId: STAY_1,
            type: "accommodation",
            quantity: 2,
            unitAmountCents: 100_000,
            isRefundableDeposit: false,
          },
          {
            reservationId: STAY_2,
            type: "accommodation",
            quantity: 2,
            unitAmountCents: 300_000,
            isRefundableDeposit: false,
          },
        ],
      }),
    );
    // Maintenance inventory retains booked revenue but is excluded from occupancy.
    const rowA = summary.propertyBreakdown.find(
      (row) => row.propertyId === PROPERTY_A,
    )!;
    const rowB = summary.propertyBreakdown.find(
      (row) => row.propertyId === PROPERTY_B,
    )!;
    expect(rowA).toMatchObject({
      occupiedNights: 2,
      bookableNights: 60,
      accommodationBookedCents: 200_000,
    });
    expect(rowB).toMatchObject({
      occupiedNights: 0,
      bookableNights: 0,
      occupancyRate: null,
      accommodationBookedCents: 600_000,
      avgAccommodationRateCents: 300_000,
    });
  });
});

describe("computeReport cash view", () => {
  it("separates booking and deposit flows and nets the operating view", () => {
    const summary = computeReport(
      baseInput({
        periodPayments: [
          { allocation: "booking", amountCents: 5000_000 },
          { allocation: "booking", amountCents: 2500_000 },
          { allocation: "security_deposit", amountCents: 1000_000 },
        ],
        periodRefunds: [
          { allocation: "booking", amountCents: 500_000 },
          { allocation: "security_deposit", amountCents: 1000_000 },
        ],
        periodExpenses: [
          { amountCents: 1200_000, classification: "operating" },
          { amountCents: 5000_000, classification: "capital" },
        ],
      }),
    );
    expect(summary.bookingCollectedCents).toBe(7500_000);
    expect(summary.depositCollectedCents).toBe(1000_000);
    expect(summary.bookingRefundedCents).toBe(500_000);
    expect(summary.depositRefundedCents).toBe(1000_000);
    expect(summary.operatingExpensesCents).toBe(1200_000);
    expect(summary.capitalSpendingCents).toBe(5000_000);
    // Deposits and capital stay out of the net operating view.
    expect(summary.netOperatingCashCents).toBe(7500_000 - 500_000 - 1200_000);
  });

  it("computes the all-time deposit position independently of the period", () => {
    const summary = computeReport(
      baseInput({
        depositsPosition: {
          collectedCents: 3000_000,
          refundedCents: 1000_000,
          deductedCents: 250_000,
        },
        periodDeductionsCents: 250_000,
      }),
    );
    expect(summary.depositsHeldCents).toBe(1750_000);
    expect(summary.depositsRetainedCents).toBe(250_000);
  });

  it("returns a null average rate when no nights were occupied", () => {
    const summary = computeReport(baseInput());
    expect(summary.avgAccommodationRateCents).toBeNull();
    expect(summary.occupancyRate).toBe(0);
  });

  it("rejects invalid periods", () => {
    expect(() =>
      computeReport(baseInput({ from: "2026-09-10", to: "2026-09-10" })),
    ).toThrow();
    expect(() =>
      computeReport(baseInput({ from: "not-a-date", to: "2026-09-10" })),
    ).toThrow();
  });
});
