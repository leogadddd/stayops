import { describe, expect, it } from "vitest";
import { computeBalances, depositSettleableCents } from "@/lib/balances";
import type { ChargeLineValues } from "@/lib/charges";

const charges: ChargeLineValues[] = [
  {
    type: "accommodation",
    description: "Accommodation (2 nights)",
    quantity: 2,
    unitAmountCents: 275_000,
  },
  {
    type: "security_deposit",
    description: "Refundable security deposit",
    quantity: 1,
    unitAmountCents: 200_000,
  },
];

describe("computeBalances", () => {
  it("matches PRD acceptance #5: booking + deposit totals, payment reduces booking balance only", () => {
    const summary = computeBalances({
      charges,
      payments: [{ allocation: "booking", amountCents: 300_000 }],
      refunds: [],
      deductions: [],
    });

    expect(summary.bookingTotalCents).toBe(550_000);
    expect(summary.depositTotalCents).toBe(200_000);
    expect(summary.paidBookingCents).toBe(300_000);
    expect(summary.bookingBalanceCents).toBe(250_000);
    expect(summary.depositHeldCents).toBe(0);
    expect(summary.depositOutstandingCents).toBe(200_000);
  });

  it("collecting the deposit raises deposit-held without touching the booking balance", () => {
    const summary = computeBalances({
      charges,
      payments: [
        { allocation: "booking", amountCents: 300_000 },
        { allocation: "security_deposit", amountCents: 200_000 },
      ],
      refunds: [],
      deductions: [],
    });

    expect(summary.depositHeldCents).toBe(200_000);
    expect(summary.depositOutstandingCents).toBe(0);
    expect(summary.bookingBalanceCents).toBe(250_000);
  });

  it("never counts the refundable deposit as booking revenue", () => {
    const summary = computeBalances({
      charges,
      payments: [{ allocation: "security_deposit", amountCents: 200_000 }],
      refunds: [],
      deductions: [],
    });

    expect(summary.bookingTotalCents).toBe(550_000);
    expect(summary.bookingBalanceCents).toBe(550_000);
  });

  it("treats an overpaid booking as a negative balance (refund obligation)", () => {
    const summary = computeBalances({
      charges,
      payments: [{ allocation: "booking", amountCents: 600_000 }],
      refunds: [],
      deductions: [],
    });

    expect(summary.bookingBalanceCents).toBe(-50_000);
  });

  it("applies discounts as negative booking amounts", () => {
    const summary = computeBalances({
      charges: [
        ...charges,
        {
          type: "discount",
          description: "Early-bird discount",
          quantity: 1,
          unitAmountCents: -50_000,
        },
      ],
      payments: [],
      refunds: [],
      deductions: [],
    });

    expect(summary.bookingTotalCents).toBe(500_000);
    expect(summary.depositTotalCents).toBe(200_000);
  });

  it("booking refunds increase the balance owed", () => {
    const summary = computeBalances({
      charges,
      payments: [{ allocation: "booking", amountCents: 300_000 }],
      refunds: [{ allocation: "booking", amountCents: 100_000 }],
      deductions: [],
    });

    expect(summary.bookingBalanceCents).toBe(350_000);
  });

  it("deposit refunds reduce deposit-held but not the booking balance", () => {
    const summary = computeBalances({
      charges,
      payments: [
        { allocation: "booking", amountCents: 300_000 },
        { allocation: "security_deposit", amountCents: 200_000 },
      ],
      refunds: [{ allocation: "security_deposit", amountCents: 50_000 }],
      deductions: [],
    });

    expect(summary.depositHeldCents).toBe(150_000);
    expect(summary.bookingBalanceCents).toBe(250_000);
  });

  it("deposit deductions reduce deposit-held", () => {
    const summary = computeBalances({
      charges,
      payments: [{ allocation: "security_deposit", amountCents: 200_000 }],
      refunds: [],
      deductions: [{ amountCents: 25_000 }],
    });

    expect(summary.depositHeldCents).toBe(175_000);
    expect(summary.deductedCents).toBe(25_000);
  });

  it("rejects fractional centavos", () => {
    expect(() =>
      computeBalances({
        charges,
        payments: [{ allocation: "booking", amountCents: 100.5 }],
        refunds: [],
        deductions: [],
      }),
    ).toThrow();
  });
});

describe("depositSettleableCents", () => {
  it("returns what can still leave through refunds plus deductions", () => {
    expect(
      depositSettleableCents({
        paidDepositCents: 200_000,
        refundedDepositCents: 50_000,
        deductedCents: 25_000,
      }),
    ).toBe(125_000);
  });

  it("is zero once the deposit is fully settled", () => {
    expect(
      depositSettleableCents({
        paidDepositCents: 200_000,
        refundedDepositCents: 200_000,
        deductedCents: 0,
      }),
    ).toBe(0);
  });

  it("clamps negative remainders to zero", () => {
    expect(
      depositSettleableCents({
        paidDepositCents: 100_000,
        refundedDepositCents: 150_000,
        deductedCents: 0,
      }),
    ).toBe(0);
  });
});
