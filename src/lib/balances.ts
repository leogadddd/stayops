import type { ChargeLineValues } from "./charges";
import { computeTotals } from "./charges";
import { assertIntegerCentavos } from "./money";

/**
 * Pure balance arithmetic for a reservation's money ledger. Booking money and
 * the refundable security deposit stay strictly separate: the deposit is a
 * liability and never reduces or inflates the booking balance (PRD §3.4).
 * All amounts are integer centavos.
 */

export interface LedgerEntryLike {
  allocation: "booking" | "security_deposit";
  amountCents: number;
}

export interface BalanceSummary {
  /** Accommodation/fees/discounts total from the charge snapshot. */
  bookingTotalCents: number;
  /** Refundable deposit required by the charge snapshot. */
  depositTotalCents: number;
  /** Payments allocated to booking charges. */
  paidBookingCents: number;
  /** Payments allocated to the security deposit. */
  paidDepositCents: number;
  /** Booking-allocation refunds (increase the balance owed). */
  refundedBookingCents: number;
  /** Deposit-allocation refunds (reduce deposit held). */
  refundedDepositCents: number;
  /** Itemized retentions out of the collected deposit. */
  deductedCents: number;
  /**
   * bookingTotal − paidBooking + refundedBooking. Positive = balance due;
   * negative = overpaid (a refund obligation, not negative revenue).
   */
  bookingBalanceCents: number;
  /** Collected deposit still in the owner's hands (paid − refunded − deducted). */
  depositHeldCents: number;
  /** Deposit still to collect before the required amount is fully held. */
  depositOutstandingCents: number;
}

export function computeBalances(input: {
  charges: readonly ChargeLineValues[];
  payments: readonly LedgerEntryLike[];
  refunds: readonly LedgerEntryLike[];
  deductions: readonly { amountCents: number }[];
}): BalanceSummary {
  const { bookingTotalCents, depositTotalCents } = computeTotals(input.charges);

  let paidBooking = 0;
  let paidDeposit = 0;
  for (const payment of input.payments) {
    assertIntegerCentavos(payment.amountCents);
    if (payment.allocation === "booking") paidBooking += payment.amountCents;
    else paidDeposit += payment.amountCents;
  }

  let refundedBooking = 0;
  let refundedDeposit = 0;
  for (const refund of input.refunds) {
    assertIntegerCentavos(refund.amountCents);
    if (refund.allocation === "booking") refundedBooking += refund.amountCents;
    else refundedDeposit += refund.amountCents;
  }

  let deducted = 0;
  for (const deduction of input.deductions) {
    assertIntegerCentavos(deduction.amountCents);
    deducted += deduction.amountCents;
  }

  const depositHeld = paidDeposit - refundedDeposit - deducted;
  return {
    bookingTotalCents,
    depositTotalCents,
    paidBookingCents: paidBooking,
    paidDepositCents: paidDeposit,
    refundedBookingCents: refundedBooking,
    refundedDepositCents: refundedDeposit,
    deductedCents: deducted,
    bookingBalanceCents: bookingTotalCents - paidBooking + refundedBooking,
    depositHeldCents: depositHeld,
    depositOutstandingCents: Math.max(0, depositTotalCents - paidDeposit),
  };
}

/**
 * How much of the collected deposit can still leave the owner's hands through
 * refunds plus deductions. Zero means fully settled; negative inputs are
 * treated as settled (callers validate amounts before calling).
 */
export function depositSettleableCents(input: {
  paidDepositCents: number;
  refundedDepositCents: number;
  deductedCents: number;
}): number {
  const remaining =
    input.paidDepositCents - input.refundedDepositCents - input.deductedCents;
  return Math.max(0, remaining);
}
