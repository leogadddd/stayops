import type { ExpenseClassification, PaymentAllocation } from "@/lib/db/schema";
import type { ChargeType, ReservationStatus, UnitStatus } from "@/lib/db/schema";
import { addDaysLocal, isLocalDate, rangesOverlap } from "@/lib/dates";
import { assertIntegerCentavos } from "@/lib/money";

/** Stays that count as occupied for occupancy and booked value. */
export const OCCUPANCY_STATUSES: readonly ReservationStatus[] = [
  "confirmed",
  "checked_in",
  "checked_out",
];

const BOOKABLE_UNIT_STATUS: UnitStatus = "active";

export interface ReportUnitInput {
  id: string;
  propertyId: string;
  status: UnitStatus;
}

export interface ReportBlockInput {
  unitId: string;
  startDate: string;
  endDate: string;
}

export interface ReportStayInput {
  id: string;
  unitId: string;
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  status: ReservationStatus;
}

export interface ReportChargeInput {
  reservationId: string;
  type: ChargeType;
  quantity: number;
  unitAmountCents: number;
  isRefundableDeposit: boolean;
}

export interface ReportPaymentInput {
  allocation: PaymentAllocation;
  amountCents: number;
}

export interface ReportExpenseInput {
  amountCents: number;
  classification: ExpenseClassification;
}

export interface DepositsPositionInput {
  collectedCents: number;
  refundedCents: number;
  deductedCents: number;
}

export interface ReportComputationInput {
  /** Half-open local date range: [from, to). */
  from: string;
  to: string;
  units: readonly ReportUnitInput[];
  blocks: readonly ReportBlockInput[];
  stays: readonly ReportStayInput[];
  charges: readonly ReportChargeInput[];
  periodPayments: readonly ReportPaymentInput[];
  periodRefunds: readonly ReportPaymentInput[];
  /** Total deposit cents retained via deductions in the period. */
  periodDeductionsCents: number;
  /** All-time deposit position: collected − refunded − deducted. */
  depositsPosition: DepositsPositionInput;
  periodExpenses: readonly ReportExpenseInput[];
}

export interface PropertyOccupancyRow {
  propertyId: string;
  occupiedNights: number;
  bookableNights: number;
  occupancyRate: number | null;
  accommodationBookedCents: number;
  avgAccommodationRateCents: number | null;
}

export interface ReportSummary {
  from: string;
  to: string;
  activeUnitCount: number;
  bookedValueCents: number;
  accommodationBookedCents: number;
  oneTimeBookedCents: number;
  occupiedNights: number;
  bookableNights: number;
  occupancyRate: number | null;
  avgAccommodationRateCents: number | null;
  bookingCollectedCents: number;
  depositCollectedCents: number;
  bookingRefundedCents: number;
  depositRefundedCents: number;
  depositsRetainedCents: number;
  depositsHeldCents: number;
  operatingExpensesCents: number;
  capitalSpendingCents: number;
  netOperatingCashCents: number;
  propertyBreakdown: PropertyOccupancyRow[];
}

export function computeReport(input: ReportComputationInput): ReportSummary {
  const { from, to } = input;
  if (!isLocalDate(from) || !isLocalDate(to) || to <= from) {
    throw new Error("Report period must be a valid half-open date range.");
  }
  for (const amount of [
    input.periodDeductionsCents,
    input.depositsPosition.collectedCents,
    input.depositsPosition.refundedCents,
    input.depositsPosition.deductedCents,
  ]) {
    assertIntegerCentavos(amount);
  }

  const bookableUnits = input.units.filter(
    (unit) => unit.status === BOOKABLE_UNIT_STATUS,
  );

  // Denominator: per-night availability of active units, minus blocked nights.
  const blockedNightsByUnit = new Map<string, Set<string>>();
  for (const block of input.blocks) {
    if (!rangesOverlap(block.startDate, block.endDate, from, to)) continue;
    let nights = blockedNightsByUnit.get(block.unitId);
    if (!nights) {
      nights = new Set();
      blockedNightsByUnit.set(block.unitId, nights);
    }
    const start = block.startDate > from ? block.startDate : from;
    const end = block.endDate < to ? block.endDate : to;
    for (
      let night = start;
      night < end;
      night = addDaysLocal(night, 1)
    ) {
      nights.add(night);
    }
  }

  const bookableByProperty = new Map<string, number>();
  let bookableNights = 0;
  for (const unit of bookableUnits) {
    const blocked = blockedNightsByUnit.get(unit.id);
    let available = 0;
    for (
      let night = from;
      night < to;
      night = addDaysLocal(night, 1)
    ) {
      if (!blocked?.has(night)) available += 1;
    }
    bookableNights += available;
    bookableByProperty.set(
      unit.propertyId,
      (bookableByProperty.get(unit.propertyId) ?? 0) + available,
    );
  }

  const bookableUnitIds = new Set(bookableUnits.map((unit) => unit.id));
  const occupiedByProperty = new Map<string, number>();
  const stayNightsByProperty = new Map<string, number>();
  let occupiedNights = 0;
  let totalStayNights = 0;
  for (const stay of input.stays) {
    if (!OCCUPANCY_STATUSES.includes(stay.status)) continue;
    if (!rangesOverlap(stay.checkInDate, stay.checkOutDate, from, to)) continue;
    const start = stay.checkInDate > from ? stay.checkInDate : from;
    const end = stay.checkOutDate < to ? stay.checkOutDate : to;
    const nights = countNights(start, end);
    totalStayNights += nights;
    stayNightsByProperty.set(
      stay.propertyId,
      (stayNightsByProperty.get(stay.propertyId) ?? 0) + nights,
    );
    if (!bookableUnitIds.has(stay.unitId)) continue;
    const blocked = blockedNightsByUnit.get(stay.unitId);
    let occupied = 0;
    for (let night = start; night < end; night = addDaysLocal(night, 1)) {
      if (!blocked?.has(night)) occupied += 1;
    }
    occupiedNights += occupied;
    occupiedByProperty.set(
      stay.propertyId,
      (occupiedByProperty.get(stay.propertyId) ?? 0) + occupied,
    );
  }

  const stayById = new Map(input.stays.map((stay) => [stay.id, stay]));
  const accommodationByProperty = new Map<string, number>();
  let accommodationBookedCents = 0;
  let oneTimeBookedCents = 0;
  for (const charge of input.charges) {
    if (charge.isRefundableDeposit || charge.type === "security_deposit") {
      continue;
    }
    const stay = stayById.get(charge.reservationId);
    if (!stay || !OCCUPANCY_STATUSES.includes(stay.status)) continue;
    if (charge.type === "accommodation") {
      if (!rangesOverlap(stay.checkInDate, stay.checkOutDate, from, to)) continue;
      const start = stay.checkInDate > from ? stay.checkInDate : from;
      const end = stay.checkOutDate < to ? stay.checkOutDate : to;
      const stayNights = countNights(stay.checkInDate, stay.checkOutDate);
      const total = charge.quantity * charge.unitAmountCents;
      assertIntegerCentavos(total);
      const nightly = Math.floor(total / stayNights);
      const remainder = total % stayNights;
      const startOffset = countNights(stay.checkInDate, start);
      const endOffset = countNights(stay.checkInDate, end);
      // Put leftover centavos on the first nights so adjacent periods add up exactly.
      const amount = nightly * (endOffset - startOffset) +
        Math.min(endOffset, remainder) - Math.min(startOffset, remainder);
      assertIntegerCentavos(amount);
      accommodationBookedCents += amount;
      accommodationByProperty.set(
        stay.propertyId,
        (accommodationByProperty.get(stay.propertyId) ?? 0) + amount,
      );
    } else {
      if (stay.checkInDate < from || stay.checkInDate >= to) continue;
      assertIntegerCentavos(charge.unitAmountCents * charge.quantity);
      oneTimeBookedCents += charge.unitAmountCents * charge.quantity;
    }
  }

  let bookingCollectedCents = 0;
  let depositCollectedCents = 0;
  for (const payment of input.periodPayments) {
    assertIntegerCentavos(payment.amountCents);
    if (payment.allocation === "booking") {
      bookingCollectedCents += payment.amountCents;
    } else {
      depositCollectedCents += payment.amountCents;
    }
  }

  let bookingRefundedCents = 0;
  let depositRefundedCents = 0;
  for (const refund of input.periodRefunds) {
    assertIntegerCentavos(refund.amountCents);
    if (refund.allocation === "booking") {
      bookingRefundedCents += refund.amountCents;
    } else {
      depositRefundedCents += refund.amountCents;
    }
  }

  let operatingExpensesCents = 0;
  let capitalSpendingCents = 0;
  for (const expense of input.periodExpenses) {
    assertIntegerCentavos(expense.amountCents);
    if (expense.classification === "operating") {
      operatingExpensesCents += expense.amountCents;
    } else {
      capitalSpendingCents += expense.amountCents;
    }
  }

  const propertyBreakdown: PropertyOccupancyRow[] = [];
  const propertyIds = new Set<string>([
    ...bookableByProperty.keys(),
    ...stayNightsByProperty.keys(),
  ]);
  for (const propertyId of propertyIds) {
    const occupied = occupiedByProperty.get(propertyId) ?? 0;
    const bookable = bookableByProperty.get(propertyId) ?? 0;
    const stayNights = stayNightsByProperty.get(propertyId) ?? 0;
    const accommodation = accommodationByProperty.get(propertyId) ?? 0;
    propertyBreakdown.push({
      propertyId,
      occupiedNights: occupied,
      bookableNights: bookable,
      occupancyRate: bookable === 0 ? null : occupied / bookable,
      accommodationBookedCents: accommodation,
      avgAccommodationRateCents:
        stayNights === 0 ? null : Math.round(accommodation / stayNights),
    });
  }
  propertyBreakdown.sort((a, b) => a.propertyId.localeCompare(b.propertyId));

  return {
    from,
    to,
    activeUnitCount: bookableUnits.length,
    bookedValueCents: accommodationBookedCents + oneTimeBookedCents,
    accommodationBookedCents,
    oneTimeBookedCents,
    occupiedNights,
    bookableNights,
    occupancyRate: bookableNights === 0 ? null : occupiedNights / bookableNights,
    avgAccommodationRateCents:
      totalStayNights === 0
        ? null
        : Math.round(accommodationBookedCents / totalStayNights),
    bookingCollectedCents,
    depositCollectedCents,
    bookingRefundedCents,
    depositRefundedCents,
    depositsRetainedCents: input.periodDeductionsCents,
    depositsHeldCents:
      input.depositsPosition.collectedCents -
      input.depositsPosition.refundedCents -
      input.depositsPosition.deductedCents,
    operatingExpensesCents,
    capitalSpendingCents,
    netOperatingCashCents:
      bookingCollectedCents - bookingRefundedCents - operatingExpensesCents,
    propertyBreakdown,
  };
}

function countNights(startInclusive: string, endExclusive: string): number {
  let count = 0;
  for (
    let night = startInclusive;
    night < endExclusive;
    night = addDaysLocal(night, 1)
  ) {
    count += 1;
  }
  return count;
}
