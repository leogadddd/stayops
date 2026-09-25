import "server-only";

import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  expenses,
  paymentEntries,
  properties,
  refundEntries,
  reservations,
  unitBlocks,
  units,
} from "@/lib/db/schema";
import { buildDashboardSeries, type DashboardSeries } from "@/lib/dashboard-series";
import { localDateTimeToUtc } from "@/lib/dates";
import { OCCUPANCY_STATUSES } from "@/lib/reporting";

// Same cash timezone as getReport, so dashboard totals reconcile with reports.
const CASH_TIMEZONE = "Asia/Manila";

/** Day-by-day cash, spending and occupancy for [from, to), organization-wide. */
export async function getDashboardSeries(
  organizationId: string,
  range: { from: string; to: string },
): Promise<DashboardSeries> {
  const { from, to } = range;
  const startUtc = localDateTimeToUtc(`${from}T00:00`, CASH_TIMEZONE)!;
  const endUtc = localDateTimeToUtc(`${to}T00:00`, CASH_TIMEZONE)!;

  const paidOn = (column: typeof paymentEntries.receivedAt | typeof refundEntries.refundedAt) =>
    // Inlined (a constant, never user input) so SELECT and GROUP BY are the same expression.
    sql<string>`to_char(${column} at time zone ${sql.raw(`'${CASH_TIMEZONE}'`)}, 'YYYY-MM-DD')`;
  const paymentDate = paidOn(paymentEntries.receivedAt);
  const refundDate = paidOn(refundEntries.refundedAt);

  const [propertyRows, unitRows, blockRows, stayRows, paymentRows, refundRows, expenseRows] = await Promise.all([
    db.select({ id: properties.id, name: properties.name })
      .from(properties)
      .where(eq(properties.organizationId, organizationId))
      .orderBy(properties.name),
    db.select({ id: units.id, propertyId: units.propertyId, status: units.status })
      .from(units)
      .where(eq(units.organizationId, organizationId)),
    db.select({ unitId: unitBlocks.unitId, startDate: unitBlocks.startDate, endDate: unitBlocks.endDate })
      .from(unitBlocks)
      .where(and(eq(unitBlocks.organizationId, organizationId), lt(unitBlocks.startDate, to), gte(unitBlocks.endDate, from))),
    db.select({ unitId: reservations.unitId, checkInDate: reservations.checkInDate, checkOutDate: reservations.checkOutDate, status: reservations.status })
      .from(reservations)
      .where(and(
        eq(reservations.organizationId, organizationId),
        inArray(reservations.status, [...OCCUPANCY_STATUSES]),
        lt(reservations.checkInDate, to),
        gte(reservations.checkOutDate, from),
      )),
    db.select({ date: paymentDate, amountCents: sql`sum(${paymentEntries.amountCents})`.mapWith(Number) })
      .from(paymentEntries)
      .where(and(
        eq(paymentEntries.organizationId, organizationId),
        eq(paymentEntries.allocation, "booking"),
        gte(paymentEntries.receivedAt, startUtc),
        lt(paymentEntries.receivedAt, endUtc),
      ))
      .groupBy(paymentDate),
    db.select({ date: refundDate, amountCents: sql`sum(${refundEntries.amountCents})`.mapWith(Number) })
      .from(refundEntries)
      .where(and(
        eq(refundEntries.organizationId, organizationId),
        eq(refundEntries.allocation, "booking"),
        gte(refundEntries.refundedAt, startUtc),
        lt(refundEntries.refundedAt, endUtc),
      ))
      .groupBy(refundDate),
    db.select({
      date: expenses.paidDate,
      category: expenses.category,
      classification: expenses.classification,
      amountCents: sql`sum(${expenses.amountCents})`.mapWith(Number),
    })
      .from(expenses)
      .where(and(eq(expenses.organizationId, organizationId), gte(expenses.paidDate, from), lt(expenses.paidDate, to)))
      .groupBy(expenses.paidDate, expenses.category, expenses.classification),
  ]);

  return buildDashboardSeries({
    from,
    to,
    properties: propertyRows,
    units: unitRows,
    blocks: blockRows,
    stays: stayRows,
    payments: paymentRows,
    refunds: refundRows,
    expenses: expenseRows,
  });
}
