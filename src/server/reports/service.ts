import "server-only";

import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  depositDeductions,
  paymentEntries,
  properties,
  refundEntries,
  reservationCharges,
  reservations,
  unitBlocks,
  units,
  expenses,
} from "@/lib/db/schema";
import { isLocalDate, localDateTimeToUtc, rangesOverlap } from "@/lib/dates";
import {
  computeReport,
  OCCUPANCY_STATUSES,
  type ReportSummary,
} from "@/lib/reporting";

export class ReportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportError";
  }
}

/** Bound the per-night occupancy loop; a year still covers every real query. */
const MAX_PERIOD_DAYS = 366;

export interface ReportFilters {
  propertyId?: string;
  from: string;
  to: string;
}

export interface ReportResult {
  summary: ReportSummary;
  properties: { id: string; name: string }[];
  propertyNames: Map<string, string>;
  timezone: string;
}

export async function getReport(
  organizationId: string,
  filters: ReportFilters,
): Promise<ReportResult> {
  const { from, to } = filters;
  if (!isLocalDate(from) || !isLocalDate(to) || to <= from) {
    throw new ReportError("Choose a valid date range.");
  }
  if (dayCount(from, to) > MAX_PERIOD_DAYS) {
    throw new ReportError("Keep the report period under a year.");
  }

  const orgProperties = await db
    .select({
      id: properties.id,
      name: properties.name,
      timezone: properties.timezone,
    })
    .from(properties)
    .where(eq(properties.organizationId, organizationId))
    .orderBy(properties.name);
  const propertyNames = new Map(orgProperties.map((p) => [p.id, p.name]));

  let propertyId = filters.propertyId ?? null;
  if (propertyId && !propertyNames.has(propertyId)) {
    throw new ReportError("Unknown property.");
  }
  // Narrowing to a single property also scopes the money queries below.
  if (!propertyId && orgProperties.length === 1) {
    propertyId = orgProperties[0]!.id;
  }
  // Cash reports use one timezone so property subtotals reconcile with all properties.
  const timezone = "Asia/Manila";

  const startUtc = localDateTimeToUtc(`${from}T00:00`, timezone);
  const endUtc = localDateTimeToUtc(`${to}T00:00`, timezone);
  if (!startUtc || !endUtc) {
    throw new ReportError("Choose a valid date range.");
  }

  const unitConditions = [eq(units.organizationId, organizationId)];
  if (propertyId) unitConditions.push(eq(units.propertyId, propertyId));
  const unitRows = await db
    .select({
      id: units.id,
      propertyId: units.propertyId,
      status: units.status,
    })
    .from(units)
    .where(and(...unitConditions));
  const unitIds = unitRows.map((unit) => unit.id);

  const blockRows =
    unitIds.length === 0
      ? []
      : await db
          .select({
            unitId: unitBlocks.unitId,
            startDate: unitBlocks.startDate,
            endDate: unitBlocks.endDate,
          })
          .from(unitBlocks)
          .where(
            and(
              eq(unitBlocks.organizationId, organizationId),
              inArray(unitBlocks.unitId, unitIds),
              lt(unitBlocks.startDate, to),
              gte(unitBlocks.endDate, from),
            ),
          );

  const stayConditions = [
    eq(reservations.organizationId, organizationId),
    inArray(reservations.status, [...OCCUPANCY_STATUSES]),
    lt(reservations.checkInDate, to),
    gte(reservations.checkOutDate, from),
  ];
  const stayRows = await db
    .select({
      id: reservations.id,
      unitId: reservations.unitId,
      propertyId: units.propertyId,
      checkInDate: reservations.checkInDate,
      checkOutDate: reservations.checkOutDate,
      status: reservations.status,
    })
    .from(reservations)
    .innerJoin(
      units,
      and(
        eq(reservations.unitId, units.id),
        eq(reservations.organizationId, units.organizationId),
      ),
    )
    .where(
      propertyId
        ? and(...stayConditions, eq(units.propertyId, propertyId))
        : and(...stayConditions),
    );
  const stayIds = stayRows.map((stay) => stay.id);

  const chargeRows =
    stayIds.length === 0
      ? []
      : await db
          .select({
            reservationId: reservationCharges.reservationId,
            type: reservationCharges.type,
            quantity: reservationCharges.quantity,
            unitAmountCents: reservationCharges.unitAmountCents,
            isRefundableDeposit: reservationCharges.isRefundableDeposit,
          })
          .from(reservationCharges)
          .where(
            and(
              eq(reservationCharges.organizationId, organizationId),
              inArray(reservationCharges.reservationId, stayIds),
            ),
          );

  // Property-scoped money rows join through the stay's unit.
  const propertyScope = propertyId ? eq(units.propertyId, propertyId) : undefined;

  const periodPayments = await db
    .select({ allocation: paymentEntries.allocation, amountCents: paymentEntries.amountCents })
    .from(paymentEntries)
    .innerJoin(
      reservations,
      and(
        eq(paymentEntries.reservationId, reservations.id),
        eq(paymentEntries.organizationId, reservations.organizationId),
      ),
    )
    .innerJoin(
      units,
      and(
        eq(reservations.unitId, units.id),
        eq(reservations.organizationId, units.organizationId),
      ),
    )
    .where(
      and(
        eq(paymentEntries.organizationId, organizationId),
        gte(paymentEntries.receivedAt, startUtc),
        lt(paymentEntries.receivedAt, endUtc),
        propertyScope,
      ),
    );

  const periodRefunds = await db
    .select({ allocation: refundEntries.allocation, amountCents: refundEntries.amountCents })
    .from(refundEntries)
    .innerJoin(
      reservations,
      and(
        eq(refundEntries.reservationId, reservations.id),
        eq(refundEntries.organizationId, reservations.organizationId),
      ),
    )
    .innerJoin(
      units,
      and(
        eq(reservations.unitId, units.id),
        eq(reservations.organizationId, units.organizationId),
      ),
    )
    .where(
      and(
        eq(refundEntries.organizationId, organizationId),
        gte(refundEntries.refundedAt, startUtc),
        lt(refundEntries.refundedAt, endUtc),
        propertyScope,
      ),
    );

  const periodDeductions = await db
    .select({ total: sql`coalesce(sum(${depositDeductions.amountCents}), 0)`.mapWith(Number) })
    .from(depositDeductions)
    .innerJoin(
      reservations,
      and(
        eq(depositDeductions.reservationId, reservations.id),
        eq(depositDeductions.organizationId, reservations.organizationId),
      ),
    )
    .innerJoin(
      units,
      and(
        eq(reservations.unitId, units.id),
        eq(reservations.organizationId, units.organizationId),
      ),
    )
    .where(
      and(
        eq(depositDeductions.organizationId, organizationId),
        gte(depositDeductions.createdAt, startUtc),
        lt(depositDeductions.createdAt, endUtc),
        propertyScope,
      ),
    );

  const expenseConditions = [
    eq(expenses.organizationId, organizationId),
    gte(expenses.paidDate, from),
    lt(expenses.paidDate, to),
  ];
  if (propertyId) expenseConditions.push(eq(expenses.propertyId, propertyId));
  const periodExpenseRows = await db
    .select({ amountCents: expenses.amountCents, classification: expenses.classification })
    .from(expenses)
    .where(and(...expenseConditions));

  // All-time deposit position, still property-scoped when a property is chosen.
  const depositCollected = await db
    .select({ total: sql`coalesce(sum(${paymentEntries.amountCents}), 0)`.mapWith(Number) })
    .from(paymentEntries)
    .innerJoin(
      reservations,
      and(
        eq(paymentEntries.reservationId, reservations.id),
        eq(paymentEntries.organizationId, reservations.organizationId),
      ),
    )
    .innerJoin(
      units,
      and(
        eq(reservations.unitId, units.id),
        eq(reservations.organizationId, units.organizationId),
      ),
    )
    .where(
      and(
        eq(paymentEntries.organizationId, organizationId),
        eq(paymentEntries.allocation, "security_deposit"),
        propertyScope,
      ),
    );

  const depositRefunded = await db
    .select({ total: sql`coalesce(sum(${refundEntries.amountCents}), 0)`.mapWith(Number) })
    .from(refundEntries)
    .innerJoin(
      reservations,
      and(
        eq(refundEntries.reservationId, reservations.id),
        eq(refundEntries.organizationId, reservations.organizationId),
      ),
    )
    .innerJoin(
      units,
      and(
        eq(reservations.unitId, units.id),
        eq(reservations.organizationId, units.organizationId),
      ),
    )
    .where(
      and(
        eq(refundEntries.organizationId, organizationId),
        eq(refundEntries.allocation, "security_deposit"),
        propertyScope,
      ),
    );

  const depositDeducted = await db
    .select({ total: sql`coalesce(sum(${depositDeductions.amountCents}), 0)`.mapWith(Number) })
    .from(depositDeductions)
    .innerJoin(
      reservations,
      and(
        eq(depositDeductions.reservationId, reservations.id),
        eq(depositDeductions.organizationId, reservations.organizationId),
      ),
    )
    .innerJoin(
      units,
      and(
        eq(reservations.unitId, units.id),
        eq(reservations.organizationId, units.organizationId),
      ),
    )
    .where(
      and(eq(depositDeductions.organizationId, organizationId), propertyScope),
    );

  const summary = computeReport({
    from,
    to,
    units: unitRows,
    blocks: blockRows.filter((block) =>
      rangesOverlap(block.startDate, block.endDate, from, to),
    ),
    stays: stayRows,
    charges: chargeRows,
    periodPayments,
    periodRefunds,
    periodDeductionsCents: periodDeductions[0]?.total ?? 0,
    depositsPosition: {
      collectedCents: depositCollected[0]?.total ?? 0,
      refundedCents: depositRefunded[0]?.total ?? 0,
      deductedCents: depositDeducted[0]?.total ?? 0,
    },
    periodExpenses: periodExpenseRows,
  });

  return {
    summary,
    properties: orgProperties.map((p) => ({ id: p.id, name: p.name })),
    propertyNames,
    timezone,
  };
}

function dayCount(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}
