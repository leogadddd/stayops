import type { ReservationFeeType } from "@/lib/db/schema";
import { formatPHP } from "@/lib/money";

/**
 * A unit's reservation fee: the down payment that secures a booking before
 * it's confirmed. `amount` is centavos for "fixed" and basis points for
 * "percent" (1000 = 10%). Pure, so the reservation form can show it live.
 */
export interface ReservationFeeRule {
  type: ReservationFeeType;
  amount: number;
}

/** A rule from the nullable column pair on units and reservations. */
export function reservationFeeRule(row: {
  reservationFeeType: ReservationFeeType | null;
  reservationFeeAmount: number | null;
}): ReservationFeeRule | null {
  if (!row.reservationFeeType || row.reservationFeeAmount === null) return null;
  return { type: row.reservationFeeType, amount: row.reservationFeeAmount };
}

/**
 * The rule a new booking takes: the unit's, unless the platform collects
 * the guest's payment itself (Airbnb, Agoda).
 */
export function applicableReservationFee(
  unit: { reservationFeeType: ReservationFeeType | null; reservationFeeAmount: number | null },
  platform: { collectsPayment: boolean } | null,
): ReservationFeeRule | null {
  if (platform?.collectsPayment) return null;
  return reservationFeeRule(unit);
}

/**
 * Centavos owed up front for a booking total, never more than the total.
 * Percentages round to the nearest centavo.
 */
export function reservationFeeCents(rule: ReservationFeeRule, bookingTotalCents: number): number {
  if (bookingTotalCents <= 0) return 0;
  const cents = rule.type === "fixed"
    ? rule.amount
    : Math.round((bookingTotalCents * rule.amount) / 10_000);
  return Math.min(cents, bookingTotalCents);
}

/** "₱1,000" or "30% of the booking total". */
export function describeReservationFee(rule: ReservationFeeRule): string {
  if (rule.type === "fixed") return formatPHP(rule.amount);
  return `${formatPercent(rule.amount)} of the booking total`;
}

/** Basis points as a percent without trailing zeros: 1250 → "12.5%". */
export function formatPercent(basisPoints: number): string {
  return `${Number((basisPoints / 100).toFixed(2))}%`;
}
