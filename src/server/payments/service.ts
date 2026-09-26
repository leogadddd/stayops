import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  auditEvents,
  damageReports,
  depositDeductions,
  paymentEntries,
  paymentProofs,
  properties,
  refundEntries,
  reservationCharges,
  reservations,
  units,
} from "@/lib/db/schema";
import {
  computeBalances,
  depositSettleableCents,
  type BalanceSummary,
} from "@/lib/balances";
import { localDateTimeToUtc } from "@/lib/dates";
import { formatPHP, MoneyParseError, pesosToCentavos } from "@/lib/money";
import { findActiveGuestToken } from "@/server/reservations/guest-link";
import {
  addDeductionSchema,
  PaymentError,
  recordPaymentSchema,
  recordRefundSchema,
  submitProofSchema,
} from "./validation";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ---------------------------------------------------------------------------
// Ledger reads
// ---------------------------------------------------------------------------

export interface ReservationLedger {
  payments: (typeof paymentEntries.$inferSelect)[];
  refunds: (typeof refundEntries.$inferSelect)[];
  deductions: (typeof depositDeductions.$inferSelect)[];
  proofs: (typeof paymentProofs.$inferSelect)[];
  balances: BalanceSummary;
}

export async function getReservationLedger(
  organizationId: string,
  reservationId: string,
): Promise<ReservationLedger> {
  const scope = and(
    eq(reservationCharges.reservationId, reservationId),
    eq(reservationCharges.organizationId, organizationId),
  );
  const [payments, refunds, deductions, proofs, charges] = await Promise.all([
    db
      .select()
      .from(paymentEntries)
      .where(
        and(
          eq(paymentEntries.reservationId, reservationId),
          eq(paymentEntries.organizationId, organizationId),
        ),
      )
      .orderBy(desc(paymentEntries.receivedAt), desc(paymentEntries.createdAt)),
    db
      .select()
      .from(refundEntries)
      .where(
        and(
          eq(refundEntries.reservationId, reservationId),
          eq(refundEntries.organizationId, organizationId),
        ),
      )
      .orderBy(desc(refundEntries.refundedAt)),
    db
      .select()
      .from(depositDeductions)
      .where(
        and(
          eq(depositDeductions.reservationId, reservationId),
          eq(depositDeductions.organizationId, organizationId),
        ),
      )
      .orderBy(desc(depositDeductions.createdAt)),
    db
      .select()
      .from(paymentProofs)
      .where(
        and(
          eq(paymentProofs.reservationId, reservationId),
          eq(paymentProofs.organizationId, organizationId),
        ),
      )
      .orderBy(asc(paymentProofs.createdAt)),
    db
      .select({
        type: reservationCharges.type,
        description: reservationCharges.description,
        quantity: reservationCharges.quantity,
        unitAmountCents: reservationCharges.unitAmountCents,
      })
      .from(reservationCharges)
      .where(scope)
      .orderBy(asc(reservationCharges.createdAt)),
  ]);
  return {
    payments,
    refunds,
    deductions,
    proofs,
    balances: computeBalances({ charges, payments, refunds, deductions }),
  };
}

/**
 * Balances for many reservations at once (for the calendar's quick view),
 * with the same arithmetic as getReservationLedger but four grouped queries
 * instead of a ledger per reservation.
 */
export async function getReservationBalances(
  organizationId: string,
  reservationIds: readonly string[],
): Promise<Map<string, BalanceSummary>> {
  const ids = [...new Set(reservationIds)];
  if (!ids.length) return new Map();
  const [charges, payments, refunds, deductions] = await Promise.all([
    db
      .select({
        reservationId: reservationCharges.reservationId,
        type: reservationCharges.type,
        description: reservationCharges.description,
        quantity: reservationCharges.quantity,
        unitAmountCents: reservationCharges.unitAmountCents,
      })
      .from(reservationCharges)
      .where(and(eq(reservationCharges.organizationId, organizationId), inArray(reservationCharges.reservationId, ids))),
    db
      .select({ reservationId: paymentEntries.reservationId, allocation: paymentEntries.allocation, amountCents: sql<number>`sum(${paymentEntries.amountCents})`.mapWith(Number) })
      .from(paymentEntries)
      .where(and(eq(paymentEntries.organizationId, organizationId), inArray(paymentEntries.reservationId, ids)))
      .groupBy(paymentEntries.reservationId, paymentEntries.allocation),
    db
      .select({ reservationId: refundEntries.reservationId, allocation: refundEntries.allocation, amountCents: sql<number>`sum(${refundEntries.amountCents})`.mapWith(Number) })
      .from(refundEntries)
      .where(and(eq(refundEntries.organizationId, organizationId), inArray(refundEntries.reservationId, ids)))
      .groupBy(refundEntries.reservationId, refundEntries.allocation),
    db
      .select({ reservationId: depositDeductions.reservationId, amountCents: sql<number>`sum(${depositDeductions.amountCents})`.mapWith(Number) })
      .from(depositDeductions)
      .where(and(eq(depositDeductions.organizationId, organizationId), inArray(depositDeductions.reservationId, ids)))
      .groupBy(depositDeductions.reservationId),
  ]);
  const of = <T extends { reservationId: string }>(rows: T[], id: string) => rows.filter((row) => row.reservationId === id);
  return new Map(ids.map((id) => [id, computeBalances({
    charges: of(charges, id),
    payments: of(payments, id),
    refunds: of(refunds, id),
    deductions: of(deductions, id),
  })]));
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

function parseAmount(amountPesos: string): number {
  try {
    return pesosToCentavos(amountPesos, { allowZero: false });
  } catch (error) {
    if (error instanceof MoneyParseError) {
      throw new PaymentError(error.message, "amountPesos");
    }
    throw error;
  }
}

async function assertReservationInOrg(
  executor: Tx | typeof db,
  organizationId: string,
  reservationId: string,
) {
  const [row] = await executor
    .select({ id: reservations.id })
    .from(reservations)
    .where(
      and(
        eq(reservations.id, reservationId),
        eq(reservations.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!row) {
    throw new PaymentError("Reservation not found.", "reservationId");
  }
}

async function propertyTimeZone(
  organizationId: string,
  reservationId: string,
): Promise<string> {
  const [row] = await db
    .select({ timeZone: properties.timezone })
    .from(reservations)
    .innerJoin(
      units,
      and(
        eq(reservations.unitId, units.id),
        eq(reservations.organizationId, units.organizationId),
      ),
    )
    .innerJoin(
      properties,
      and(
        eq(units.propertyId, properties.id),
        eq(properties.organizationId, reservations.organizationId),
      ),
    )
    .where(
      and(
        eq(reservations.id, reservationId),
        eq(reservations.organizationId, organizationId),
      ),
    )
    .limit(1);
  return row?.timeZone ?? "Asia/Manila";
}

function isUniqueViolation(error: unknown): boolean {
  if (error instanceof Error && error.cause) return isUniqueViolation(error.cause);
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "23505"
  );
}

export async function recordPayment(input: {
  organizationId: string;
  actorUserId: string;
  reservationId: string;
  data: unknown;
  /** When recording from a guest proof, mark it recorded in the same tx. */
  proofId?: string;
}): Promise<{ entry: typeof paymentEntries.$inferSelect; alreadyRecorded: boolean }> {
  const data = recordPaymentSchema.parse(input.data);
  const amountCents = parseAmount(data.amountPesos);

  if (data.idempotencyKey) {
    const [existing] = await db
      .select()
      .from(paymentEntries)
      .where(
        and(
          eq(paymentEntries.organizationId, input.organizationId),
          eq(paymentEntries.idempotencyKey, data.idempotencyKey),
        ),
      )
      .limit(1);
    if (existing) return { entry: existing, alreadyRecorded: true };
  }

  let receivedAt = new Date();
  if (data.receivedAt) {
    const timeZone = await propertyTimeZone(input.organizationId, input.reservationId);
    const parsed = localDateTimeToUtc(data.receivedAt, timeZone);
    if (!parsed) {
      throw new PaymentError("Use a valid date and time.", "receivedAt");
    }
    receivedAt = parsed;
  }

  try {
    return await db.transaction(async (tx) => {
      await assertReservationInOrg(tx, input.organizationId, input.reservationId);
      const [entry] = await tx
        .insert(paymentEntries)
        .values({
          organizationId: input.organizationId,
          reservationId: input.reservationId,
          allocation: data.allocation,
          amountCents,
          method: data.method,
          reference: data.reference || null,
          receivedAt,
          recordedBy: input.actorUserId,
          idempotencyKey: data.idempotencyKey ?? null,
        })
        .returning();
      if (!entry) {
        throw new PaymentError("Failed to record the payment.");
      }
      if (input.proofId) {
        await tx
          .update(paymentProofs)
          .set({ status: "recorded", reviewedAt: new Date() })
          .where(
            and(
              eq(paymentProofs.id, input.proofId),
              eq(paymentProofs.organizationId, input.organizationId),
              eq(paymentProofs.reservationId, input.reservationId),
              eq(paymentProofs.status, "unverified"),
            ),
          );
      }
      await tx.insert(auditEvents).values({
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        entity: "payment_entry",
        entityId: entry.id,
        action: "payment.recorded",
        metadata: {
          reservationId: input.reservationId,
          allocation: data.allocation,
          amountCents,
          method: data.method,
        },
      });
      return { entry, alreadyRecorded: false };
    });
  } catch (error) {
    if (isUniqueViolation(error) && data.idempotencyKey) {
      const [existing] = await db
        .select()
        .from(paymentEntries)
        .where(
          and(
            eq(paymentEntries.organizationId, input.organizationId),
            eq(paymentEntries.idempotencyKey, data.idempotencyKey),
          ),
        )
        .limit(1);
      if (existing) return { entry: existing, alreadyRecorded: true };
    }
    throw error;
  }
}

async function ledgerCaps(
  executor: Tx | typeof db,
  organizationId: string,
  reservationId: string,
) {
  const [payments, refunds, deductions] = await Promise.all([
    executor
      .select()
      .from(paymentEntries)
      .where(
        and(
          eq(paymentEntries.reservationId, reservationId),
          eq(paymentEntries.organizationId, organizationId),
        ),
      ),
    executor
      .select()
      .from(refundEntries)
      .where(
        and(
          eq(refundEntries.reservationId, reservationId),
          eq(refundEntries.organizationId, organizationId),
        ),
      ),
    executor
      .select()
      .from(depositDeductions)
      .where(
        and(
          eq(depositDeductions.reservationId, reservationId),
          eq(depositDeductions.organizationId, organizationId),
        ),
      ),
  ]);
  return computeBalances({ charges: [], payments, refunds, deductions });
}

export async function recordRefund(input: {
  organizationId: string;
  actorUserId: string;
  reservationId: string;
  data: unknown;
}) {
  const data = recordRefundSchema.parse(input.data);
  const amountCents = parseAmount(data.amountPesos);

  return db.transaction(async (tx) => {
    await assertReservationInOrg(tx, input.organizationId, input.reservationId);
    const balances = await ledgerCaps(tx, input.organizationId, input.reservationId);

    if (data.allocation === "security_deposit") {
      const settleable = depositSettleableCents({
        paidDepositCents: balances.paidDepositCents,
        refundedDepositCents: balances.refundedDepositCents,
        deductedCents: balances.deductedCents,
      });
      if (amountCents > settleable) {
        throw new PaymentError(
          `That refund exceeds the deposit still held (${formatPHP(settleable)}).`,
          "amountPesos",
        );
      }
    } else {
      const refundable =
        balances.paidBookingCents - balances.refundedBookingCents;
      if (amountCents > refundable) {
        throw new PaymentError(
          `That refund exceeds the booking payments recorded (${formatPHP(refundable)}).`,
          "amountPesos",
        );
      }
    }

    const [entry] = await tx
      .insert(refundEntries)
      .values({
        organizationId: input.organizationId,
        reservationId: input.reservationId,
        allocation: data.allocation,
        amountCents,
        method: data.method,
        reason: data.reason,
        refundedAt: new Date(),
        recordedBy: input.actorUserId,
      })
      .returning();
    if (!entry) {
      throw new PaymentError("Failed to record the refund.");
    }
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "refund_entry",
      entityId: entry.id,
      action: "refund.recorded",
      metadata: {
        reservationId: input.reservationId,
        allocation: data.allocation,
        amountCents,
      },
    });
    return entry;
  });
}

export async function addDeduction(input: {
  organizationId: string;
  actorUserId: string;
  reservationId: string;
  data: unknown;
}) {
  const data = addDeductionSchema.parse(input.data);
  const amountCents = parseAmount(data.amountPesos);

  return db.transaction(async (tx) => {
    const [reservation] = await tx
      .select({ id: reservations.id, unitId: reservations.unitId })
      .from(reservations)
      .where(
        and(
          eq(reservations.id, input.reservationId),
          eq(reservations.organizationId, input.organizationId),
        ),
      )
      .limit(1);
    if (!reservation) {
      throw new PaymentError("Reservation not found.", "reservationId");
    }

    let damageReportId: string | null = null;
    if (data.damageReportId) {
      const [report] = await tx
        .select({ id: damageReports.id, unitId: damageReports.unitId })
        .from(damageReports)
        .where(
          and(
            eq(damageReports.id, data.damageReportId),
            eq(damageReports.organizationId, input.organizationId),
          ),
        )
        .limit(1);
      if (!report) {
        throw new PaymentError("Damage report not found.", "damageReportId");
      }
      if (report.unitId !== reservation.unitId) {
        throw new PaymentError(
          "That damage report belongs to a different unit.",
          "damageReportId",
        );
      }
      damageReportId = report.id;
    }

    const balances = await ledgerCaps(tx, input.organizationId, input.reservationId);
    const settleable = depositSettleableCents({
      paidDepositCents: balances.paidDepositCents,
      refundedDepositCents: balances.refundedDepositCents,
      deductedCents: balances.deductedCents,
    });
    if (amountCents > settleable) {
      throw new PaymentError(
        `That deduction exceeds the deposit still held (${formatPHP(settleable)}).`,
        "amountPesos",
      );
    }

    const [entry] = await tx
      .insert(depositDeductions)
      .values({
        organizationId: input.organizationId,
        reservationId: input.reservationId,
        damageReportId,
        amountCents,
        reason: data.reason,
        createdBy: input.actorUserId,
      })
      .returning();
    if (!entry) {
      throw new PaymentError("Failed to record the deduction.");
    }
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "deposit_deduction",
      entityId: entry.id,
      action: "deposit.deducted",
      metadata: {
        reservationId: input.reservationId,
        amountCents,
        damageReportId,
      },
    });
    return entry;
  });
}

// ---------------------------------------------------------------------------
// Guest-submitted payment proofs (public endpoint, token-authenticated)
// ---------------------------------------------------------------------------

export async function submitGuestPaymentProof(input: {
  token: string;
  data: unknown;
}) {
  const data = submitProofSchema.parse(input.data);
  const tokenRow = await findActiveGuestToken(input.token);
  if (!tokenRow) {
    throw new PaymentError("This link is not valid.");
  }
  return db.transaction(async (tx) => {
    const [proof] = await tx
      .insert(paymentProofs)
      .values({
        organizationId: tokenRow.organizationId,
        reservationId: tokenRow.reservationId,
        reference: data.reference,
        note: data.note || null,
      })
      .returning();
    if (!proof) {
      throw new PaymentError("Failed to submit the reference.");
    }
    await tx.insert(auditEvents).values({
      organizationId: tokenRow.organizationId,
      actorUserId: null,
      entity: "payment_proof",
      entityId: proof.id,
      action: "payment_proof.submitted",
      metadata: { reservationId: tokenRow.reservationId },
    });
    return proof;
  });
}

export async function dismissProof(input: {
  organizationId: string;
  actorUserId: string;
  proofId: string;
}) {
  return db.transaction(async (tx) => {
    const [proof] = await tx
      .select()
      .from(paymentProofs)
      .where(
        and(
          eq(paymentProofs.id, input.proofId),
          eq(paymentProofs.organizationId, input.organizationId),
        ),
      )
      .limit(1);
    if (!proof || proof.status !== "unverified") {
      throw new PaymentError("Proof not found or already reviewed.", "proofId");
    }
    await tx
      .update(paymentProofs)
      .set({ status: "dismissed", reviewedAt: new Date() })
      .where(eq(paymentProofs.id, proof.id));
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "payment_proof",
      entityId: proof.id,
      action: "payment_proof.dismissed",
      metadata: { reservationId: proof.reservationId },
    });
  });
}
