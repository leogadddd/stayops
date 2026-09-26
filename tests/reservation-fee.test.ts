import { describe, expect, it } from "vitest";
import { applicableReservationFee, describeReservationFee, formatPercent, reservationFeeCents } from "@/lib/reservation-fee";

describe("reservation fee", () => {
  it("takes a fixed amount, never more than the booking total", () => {
    expect(reservationFeeCents({ type: "fixed", amount: 100_000 }, 500_000)).toBe(100_000);
    expect(reservationFeeCents({ type: "fixed", amount: 100_000 }, 60_000)).toBe(60_000);
    expect(reservationFeeCents({ type: "fixed", amount: 100_000 }, 0)).toBe(0);
  });

  it("takes a percentage of the booking total, rounded to the centavo", () => {
    expect(reservationFeeCents({ type: "percent", amount: 3000 }, 500_000)).toBe(150_000);
    expect(reservationFeeCents({ type: "percent", amount: 3333 }, 100_001)).toBe(33_330);
    expect(reservationFeeCents({ type: "percent", amount: 10_000 }, 250_000)).toBe(250_000);
  });

  it("doesn't apply to platforms that collect payment themselves", () => {
    const unit = { reservationFeeType: "fixed" as const, reservationFeeAmount: 100_000 };
    expect(applicableReservationFee(unit, { collectsPayment: true })).toBeNull();
    expect(applicableReservationFee(unit, { collectsPayment: false })).toEqual({ type: "fixed", amount: 100_000 });
    expect(applicableReservationFee(unit, null)).toEqual({ type: "fixed", amount: 100_000 });
    expect(applicableReservationFee({ reservationFeeType: null, reservationFeeAmount: null }, null)).toBeNull();
  });

  it("describes the rule", () => {
    expect(formatPercent(1250)).toBe("12.5%");
    expect(describeReservationFee({ type: "percent", amount: 3000 })).toBe("30% of the booking total");
    expect(describeReservationFee({ type: "fixed", amount: 150_000 })).toMatch(/1,500/);
  });
});
