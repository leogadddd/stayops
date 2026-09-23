import "server-only";

import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  accessTokens,
  auditEvents,
  guests,
  properties,
  reservationCharges,
  reservationTransitions,
  reservations,
  units,
  type ReservationStatus,
  type Unit,
} from "@/lib/db/schema";
import { assertIntegerCentavos } from "@/lib/money";
import { computeTotals } from "@/lib/charges";
import { getUnitOrThrow } from "@/server/inventory/service";
import {
  checkIntervalAvailability,
  getOccupancySegments,
} from "@/server/inventory/availability";
import { expireStaleHolds } from "./holds";
import {
  cancelReservationSchema,
  confirmHoldSchema,
  createConfirmedSchema,
  createHoldSchema,
  guestInputSchema,
  isAllowedTransition,
  ReservationError,
  type ChargeLineInput,
  type CreateConfirmedInput,
  type CreateHoldInput,
  type GuestInput,
} from "./validation";

export { ReservationError } from "./validation";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ---------------------------------------------------------------------------
// Guests
// ---------------------------------------------------------------------------

export async function listGuests(organizationId: string, query?: string) {
  const conditions = [eq(guests.organizationId, organizationId)];
  const q = query?.trim();
  if (q) {
    conditions.push(
      or(
        ilike(guests.name, `%${q}%`),
        ilike(guests.email, `%${q}%`),
        ilike(guests.phone, `%${q}%`),
      )!,
    );
  }
  return db
    .select()
    .from(guests)
    .where(and(...conditions))
    .orderBy(asc(guests.name));
}

export async function createGuest(input: {
  organizationId: string;
  actorUserId: string;
  data: GuestInput;
}) {
  const data = guestInputSchema.parse(input.data);
  return db.transaction(async (tx) => {
    const [guest] = await tx
      .insert(guests)
      .values({
        organizationId: input.organizationId,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        notes: data.notes || null,
      })
      .returning();
    if (!guest) {
      throw new ReservationError("Failed to create the guest.");
    }
    await recordAudit(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "guest",
      entityId: guest.id,
      action: "guest.created",
      metadata: { name: guest.name },
    });
    return guest;
  });
}

export async function getGuestOrThrow(organizationId: string, guestId: string) {
  const [guest] = await db
    .select()
    .from(guests)
    .where(and(eq(guests.id, guestId), eq(guests.organizationId, organizationId)))
    .limit(1);
  if (!guest) {
    throw new ReservationError("Guest not found.", "guestId");
  }
  return guest;
}

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------

export { buildDefaultCharges, computeTotals } from "@/lib/charges";

export interface ReservationListFilters {
  query?: string;
  status?: ReservationStatus;
  unitId?: string;
}

export async function listReservations(
  organizationId: string,
  filters: ReservationListFilters = {},
) {
  const conditions = [eq(reservations.organizationId, organizationId)];
  const q = filters.query?.trim();
  if (q) {
    conditions.push(
      or(
        ilike(guests.name, `%${q}%`),
        ilike(guests.email, `%${q}%`),
        ilike(guests.phone, `%${q}%`),
      )!,
    );
  }
  if (filters.status) {
    conditions.push(eq(reservations.status, filters.status));
  }
  if (filters.unitId) {
    conditions.push(eq(reservations.unitId, filters.unitId));
  }

  return db
    .select({
      id: reservations.id,
      status: reservations.status,
      checkInDate: reservations.checkInDate,
      checkOutDate: reservations.checkOutDate,
      guestCount: reservations.guestCount,
      expiresAt: reservations.expiresAt,
      createdAt: reservations.createdAt,
      guestId: guests.id,
      guestName: guests.name,
      unitId: units.id,
      unitName: units.name,
    })
    .from(reservations)
    .innerJoin(
      guests,
      and(
        eq(reservations.guestId, guests.id),
        eq(reservations.organizationId, guests.organizationId),
      ),
    )
    .innerJoin(
      units,
      and(
        eq(reservations.unitId, units.id),
        eq(reservations.organizationId, units.organizationId),
      ),
    )
    .where(and(...conditions))
    .orderBy(desc(reservations.checkInDate));
}

export async function getReservationDetail(
  organizationId: string,
  reservationId: string,
) {
  const [reservation] = await db
    .select()
    .from(reservations)
    .where(
      and(
        eq(reservations.id, reservationId),
        eq(reservations.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!reservation) {
    throw new ReservationError("Reservation not found.", "reservationId");
  }

  const [guest, unit, charges, transitions, tokens] = await Promise.all([
    getGuestOrThrow(organizationId, reservation.guestId),
    getUnitOrThrow(organizationId, reservation.unitId),
    db
      .select()
      .from(reservationCharges)
      .where(
        and(
          eq(reservationCharges.reservationId, reservationId),
          eq(reservationCharges.organizationId, organizationId),
        ),
      )
      .orderBy(asc(reservationCharges.createdAt), asc(reservationCharges.id)),
    db
      .select()
      .from(reservationTransitions)
      .where(
        and(
          eq(reservationTransitions.reservationId, reservationId),
          eq(reservationTransitions.organizationId, organizationId),
        ),
      )
      .orderBy(asc(reservationTransitions.createdAt)),
    db
      .select()
      .from(accessTokens)
      .where(
        and(
          eq(accessTokens.reservationId, reservationId),
          eq(accessTokens.organizationId, organizationId),
        ),
      )
      .orderBy(desc(accessTokens.createdAt)),
  ]);

  const property = await db
    .select()
    .from(properties)
    .where(eq(properties.id, unit.propertyId))
    .limit(1);

  const now = new Date();
  const activeToken =
    tokens.find(
      (token) => token.revokedAt === null && token.expiresAt > now,
    ) ?? null;

  return {
    reservation,
    guest,
    unit,
    property: property[0] ?? null,
    charges,
    transitions,
    activeToken,
  };
}

async function recordAudit(
  tx: Tx,
  input: {
    organizationId: string;
    actorUserId: string;
    entity: string;
    entityId: string;
    action: string;
    metadata?: Record<string, unknown>;
  },
) {
  await tx.insert(auditEvents).values({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    entity: input.entity,
    entityId: input.entityId,
    action: input.action,
    metadata: input.metadata,
  });
}

async function insertTransition(
  tx: Tx,
  input: {
    organizationId: string;
    reservationId: string;
    fromStatus: ReservationStatus | null;
    toStatus: ReservationStatus;
    note?: string;
    actorUserId: string;
  },
) {
  await tx.insert(reservationTransitions).values({
    organizationId: input.organizationId,
    reservationId: input.reservationId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    note: input.note ?? null,
    actorUserId: input.actorUserId,
  });
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "23505"
  );
}

function isExclusionViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "23P01"
  );
}

function assertBookableUnit(unit: Unit) {
  if (unit.status !== "active") {
    throw new ReservationError(
      "This unit is not accepting new holds or reservations right now.",
      "unitId",
    );
  }
}

interface CreateReservationArgs {
  organizationId: string;
  actorUserId: string;
  guest: { guestId?: string; newGuest?: GuestInput };
  idempotencyKey?: string;
}

/**
 * Shared create path for holds and confirmed reservations. The advisory
 * availability check runs first for a friendly error; the exclusion
 * constraint remains the authority under concurrent submissions.
 */
async function createReservation(
  args: CreateReservationArgs & {
    status: "hold" | "confirmed";
    values: {
      unitId: string;
      checkIn: string;
      checkOut: string;
      guestCount: number;
      charges: ChargeLineInput[];
      expiresAt: Date | null;
      confirmReason: string | null;
    };
  },
) {
  const { organizationId, actorUserId } = args;
  const { values } = args;

  const unit = await getUnitOrThrow(organizationId, values.unitId);
  assertBookableUnit(unit);
  if (values.guestCount > unit.capacity) {
    throw new ReservationError(
      `This unit sleeps ${unit.capacity}; the guest count is too high.`,
      "guestCount",
    );
  }

  // Expire stale holds (auto-commit) so the advisory check sees fresh state.
  const segments = (
    await getOccupancySegments(organizationId, [unit.id], values.checkIn, values.checkOut)
  ).get(unit.id) ?? [];
  const check = checkIntervalAvailability(segments, values.checkIn, values.checkOut);
  if (!check.available) {
    throw new ReservationError(
      `Those dates conflict with ${check.conflict.reason} (${check.conflict.startDate} → ${check.conflict.endDate}).`,
      "checkIn",
    );
  }

  if (args.idempotencyKey) {
    const [existing] = await db
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.organizationId, organizationId),
          eq(reservations.idempotencyKey, args.idempotencyKey),
        ),
      )
      .limit(1);
    if (existing) return existing;
  }

  try {
    return await db.transaction(async (tx) => {
      // Stale holds must be expired in the same transaction before the
      // availability decision commits (PRD §5).
      await expireStaleHolds(tx, organizationId);

      let guestId: string;
      if (args.guest.guestId) {
        const guest = await tx
          .select({ id: guests.id })
          .from(guests)
          .where(
            and(eq(guests.id, args.guest.guestId), eq(guests.organizationId, organizationId)),
          )
          .limit(1);
        if (!guest[0]) {
          throw new ReservationError("Guest not found.", "guestId");
        }
        guestId = guest[0].id;
      } else if (args.guest.newGuest) {
        const data = guestInputSchema.parse(args.guest.newGuest);
        const [created] = await tx
          .insert(guests)
          .values({
            organizationId,
            name: data.name,
            email: data.email || null,
            phone: data.phone || null,
            notes: data.notes || null,
          })
          .returning({ id: guests.id });
        if (!created) {
          throw new ReservationError("Failed to create the guest.");
        }
        guestId = created.id;
        await recordAudit(tx, {
          organizationId,
          actorUserId,
          entity: "guest",
          entityId: guestId,
          action: "guest.created",
          metadata: { name: data.name },
        });
      } else {
        throw new ReservationError("Choose a guest or enter a new one.", "guestId");
      }

      const [reservation] = await tx
        .insert(reservations)
        .values({
          organizationId,
          unitId: unit.id,
          guestId,
          checkInDate: values.checkIn,
          checkOutDate: values.checkOut,
          status: args.status,
          guestCount: values.guestCount,
          expiresAt: values.expiresAt,
          confirmReason: values.confirmReason,
          idempotencyKey: args.idempotencyKey ?? null,
        })
        .returning();
      if (!reservation) {
        throw new ReservationError("Failed to create the reservation.");
      }

      for (const line of values.charges) {
        const amountCents = line.quantity * line.unitAmountCents;
        assertIntegerCentavos(amountCents);
        await tx.insert(reservationCharges).values({
          organizationId,
          reservationId: reservation.id,
          type: line.type,
          description: line.description,
          quantity: line.quantity,
          unitAmountCents: line.unitAmountCents,
          amountCents,
          isRefundableDeposit: line.type === "security_deposit",
        });
      }

      await insertTransition(tx, {
        organizationId,
        reservationId: reservation.id,
        fromStatus: null,
        toStatus: args.status,
        note:
          args.status === "hold"
            ? `Hold created, expires ${values.expiresAt?.toISOString() ?? "n/a"}.`
            : "Reservation confirmed.",
        actorUserId,
      });
      await recordAudit(tx, {
        organizationId,
        actorUserId,
        entity: "reservation",
        entityId: reservation.id,
        action: "reservation.created",
        metadata: {
          status: args.status,
          unitId: unit.id,
          checkIn: values.checkIn,
          checkOut: values.checkOut,
        },
      });
      return reservation;
    });
  } catch (error) {
    if (isExclusionViolation(error)) {
      throw new ReservationError(
        "Those dates are no longer available — another hold or booking overlaps them.",
        "checkIn",
      );
    }
    if (isUniqueViolation(error) && args.idempotencyKey) {
      const [existing] = await db
        .select()
        .from(reservations)
        .where(
          and(
            eq(reservations.organizationId, organizationId),
            eq(reservations.idempotencyKey, args.idempotencyKey),
          ),
        )
        .limit(1);
      if (existing) return existing;
    }
    throw error;
  }
}

export async function createHold(
  args: CreateReservationArgs & { data: CreateHoldInput },
) {
  const data = createHoldSchema.parse(args.data);
  const expiresAt = new Date(Date.now() + data.holdMinutes * 60_000);
  return createReservation({
    ...args,
    status: "hold",
    values: {
      unitId: data.unitId,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      guestCount: data.guestCount,
      charges: data.charges,
      expiresAt,
      confirmReason: null,
    },
  });
}

export async function createConfirmed(
  args: CreateReservationArgs & { data: CreateConfirmedInput },
) {
  const data = createConfirmedSchema.parse(args.data);
  const { bookingTotalCents } = computeTotals(data.charges);
  if (bookingTotalCents > 0 && !data.acknowledgeUnpaid) {
    throw new ReservationError(
      "This reservation has an unpaid balance. Tick the acknowledgement to confirm it anyway.",
      "acknowledgeUnpaid",
    );
  }
  return createReservation({
    ...args,
    status: "confirmed",
    values: {
      unitId: data.unitId,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      guestCount: data.guestCount,
      charges: data.charges,
      expiresAt: null,
      confirmReason: null,
    },
  });
}

export async function confirmHold(input: {
  organizationId: string;
  actorUserId: string;
  reservationId: string;
  reason: string;
}) {
  const { reason } = confirmHoldSchema.parse({ reason: input.reason });

  return db.transaction(async (tx) => {
    await expireStaleHolds(tx, input.organizationId);
    const [reservation] = await tx
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.id, input.reservationId),
          eq(reservations.organizationId, input.organizationId),
        ),
      )
      .limit(1);
    if (!reservation) {
      throw new ReservationError("Reservation not found.", "reservationId");
    }
    if (reservation.status === "expired") {
      throw new ReservationError(
        "This hold has expired and the dates were released. Create a new hold or booking instead.",
      );
    }
    if (!isAllowedTransition(reservation.status, "confirmed")) {
      throw new ReservationError(
        `A ${reservation.status} reservation cannot be confirmed.`,
      );
    }

    const [updated] = await tx
      .update(reservations)
      .set({
        status: "confirmed",
        expiresAt: null,
        confirmReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(reservations.id, reservation.id))
      .returning();
    if (!updated) {
      throw new ReservationError("Failed to confirm the hold.");
    }
    await insertTransition(tx, {
      organizationId: input.organizationId,
      reservationId: reservation.id,
      fromStatus: reservation.status,
      toStatus: "confirmed",
      note: `Confirmed without a recorded deposit — ${reason}`,
      actorUserId: input.actorUserId,
    });
    await recordAudit(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "reservation",
      entityId: reservation.id,
      action: "reservation.confirmed",
      metadata: { reason },
    });
    return updated;
  });
}

export async function cancelReservation(input: {
  organizationId: string;
  actorUserId: string;
  reservationId: string;
  reason: string;
}) {
  const { reason } = cancelReservationSchema.parse({ reason: input.reason });

  return db.transaction(async (tx) => {
    const [reservation] = await tx
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.id, input.reservationId),
          eq(reservations.organizationId, input.organizationId),
        ),
      )
      .limit(1);
    if (!reservation) {
      throw new ReservationError("Reservation not found.", "reservationId");
    }
    if (!isAllowedTransition(reservation.status, "cancelled")) {
      throw new ReservationError(
        `A ${reservation.status} reservation cannot be cancelled here.`,
      );
    }

    const [updated] = await tx
      .update(reservations)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(reservations.id, reservation.id))
      .returning();
    if (!updated) {
      throw new ReservationError("Failed to cancel the reservation.");
    }
    await insertTransition(tx, {
      organizationId: input.organizationId,
      reservationId: reservation.id,
      fromStatus: reservation.status,
      toStatus: "cancelled",
      note: reason,
      actorUserId: input.actorUserId,
    });
    await recordAudit(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "reservation",
      entityId: reservation.id,
      action: "reservation.cancelled",
      metadata: { reason },
    });
    return updated;
  });
}

/** Live holds whose expiry is still in the future (for countdown display). */
export function isLiveHold(
  status: ReservationStatus,
  expiresAt: Date | null,
): boolean {
  return status === "hold" && expiresAt !== null && expiresAt > new Date();
}