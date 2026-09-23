import type { ChargeType } from "@/lib/db/schema";
import { assertIntegerCentavos } from "@/lib/money";

/**
 * Pure helpers for the agreed charge snapshot shared by the reservation form
 * (client), the reservation service and the public guest page. No server-only
 * imports here so the form can build default lines and live totals.
 */

export const CHARGE_TYPE_LABELS: Record<ChargeType, string> = {
  accommodation: "Accommodation",
  cleaning: "Cleaning fee",
  fee: "Extra fee",
  discount: "Discount",
  security_deposit: "Security deposit (refundable)",
};

export interface ChargeLineValues {
  type: ChargeType;
  description: string;
  quantity: number;
  unitAmountCents: number;
}

/** Default charge lines for a stay, built from the unit's current defaults. */
export function buildDefaultCharges(input: {
  nightlyRateCents: number;
  cleaningFeeCents: number | null;
  securityDepositCents: number | null;
  nights: number;
}): ChargeLineValues[] {
  const lines: ChargeLineValues[] = [
    {
      type: "accommodation",
      description: `Accommodation (${input.nights} ${input.nights === 1 ? "night" : "nights"})`,
      quantity: input.nights,
      unitAmountCents: input.nightlyRateCents,
    },
  ];
  if (input.cleaningFeeCents !== null) {
    lines.push({
      type: "cleaning",
      description: "Cleaning fee",
      quantity: 1,
      unitAmountCents: input.cleaningFeeCents,
    });
  }
  if (input.securityDepositCents !== null) {
    lines.push({
      type: "security_deposit",
      description: "Refundable security deposit",
      quantity: 1,
      unitAmountCents: input.securityDepositCents,
    });
  }
  return lines;
}

/**
 * Booking total excludes refundable deposits. Discounts are already negative,
 * so a plain sum of non-deposit lines yields the balance due.
 */
export function computeTotals(charges: readonly ChargeLineValues[]): {
  bookingTotalCents: number;
  depositTotalCents: number;
} {
  let booking = 0;
  let deposit = 0;
  for (const line of charges) {
    const amount = line.quantity * line.unitAmountCents;
    assertIntegerCentavos(amount);
    if (line.type === "security_deposit") deposit += amount;
    else booking += amount;
  }
  return { bookingTotalCents: booking, depositTotalCents: deposit };
}
