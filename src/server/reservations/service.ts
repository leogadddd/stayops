import "server-only";

import { and, asc, desc, eq, gte, ilike, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  accessTokens,
  auditEvents,
  bookingPlatforms,
  guests,
  properties,
  paymentEntries,
  refundEntries,
  reservationCharges,
  reservationOccupants,
  reservationTransitions,
  reservations,
  units,
  type ReservationStatus,
  type Unit,
} from "@/lib/db/schema";
import { assertIntegerCentavos, formatPHP, MoneyParseError, pesosToCentavos } from "@/lib/money";
import { computeTotals } from "@/lib/charges";
import { applicableReservationFee, reservationFeeCents, reservationFeeRule } from "@/lib/reservation-fee";
import { getUnitOrThrow } from "@/server/inventory/service";
import {
  checkIntervalAvailability,
  findTurnoverArrivalConflict,
  getOccupancySegments,
} from "@/server/inventory/availability";
import { localDateTimeToUtc } from "@/lib/dates";
import { expireStaleHolds } from "./holds";
import { assertPlatform } from "./platforms";
import {
  cancelReservationSchema,
  confirmHoldSchema,
  createConfirmedSchema,
  createHoldSchema,
  guestInputSchema,
  guestProfileSchema,
  isAllowedTransition,
  ReservationError,
  type ChargeLineInput,
  type CreateConfirmedInput,
  type CreateHoldInput,
  type GuestInput,
  type GuestProfileInput,
  updateReservationSchema,
  type UpdateReservationInput,
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

/** A parsed profile as guest columns, with blank optional fields stored as null. */
function guestProfileValues(input: GuestProfileInput) {
  const data = guestProfileSchema.parse(input);
  return {
    name: data.name,
    email: data.email || null,
    phone: data.phone || null,
    notes: data.notes || null,
    preferredName: data.preferredName || null,
    birthDate: data.birthDate || null,
    nationality: data.nationality || null,
    idType: data.idType ?? null,
    idNumber: data.idNumber || null,
    address: data.address || null,
    company: data.company || null,
    tin: data.tin || null,
    emergencyContactName: data.emergencyContactName || null,
    emergencyContactPhone: data.emergencyContactPhone || null,
    tags: data.tags,
    flagged: data.flagged,
    // A reason only means something while the guest is flagged.
    flagReason: data.flagged ? data.flagReason || null : null,
    marketingOptIn: data.marketingOptIn,
  };
}

export async function createGuest(input: {
  organizationId: string;
  actorUserId: string;
  data: GuestProfileInput;
}) {
  const values = guestProfileValues(input.data);
  return db.transaction(async (tx) => {
    const [guest] = await tx
      .insert(guests)
      .values({ organizationId: input.organizationId, ...values })
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

export const GUEST_ACTIVITIES = ["in_house", "upcoming", "past", "no_stays"] as const;
export type GuestActivity = (typeof GUEST_ACTIVITIES)[number];
export const GUEST_SORTS = ["name", "recent", "stays", "added"] as const;
export type GuestSort = (typeof GUEST_SORTS)[number];

export const GUEST_DIRECTORY_SHOWS = ["missing_email", "missing_phone", "flagged", "marketing"] as const;
export type GuestDirectoryShow = (typeof GUEST_DIRECTORY_SHOWS)[number];

export interface GuestDirectoryFilters {
  query?: string;
  /** Missing email or phone to chase up, flagged guests, or those who agreed to promotions. */
  show?: GuestDirectoryShow;
  sort?: GuestSort;
  /** Adds spentCents (booking value of kept stays). Owner views only. */
  includeSpend?: boolean;
}

/**
 * Guests with their booking history rolled up. Cancelled and expired
 * reservations count towards `reservationCount` only, never towards stays,
 * nights or spend. `activity` is the guest's most current state.
 */
export async function listGuestDirectory(organizationId: string, filters: GuestDirectoryFilters = {}) {
  const conditions = [eq(guests.organizationId, organizationId)];
  const q = filters.query?.trim();
  if (q) {
    conditions.push(or(ilike(guests.name, `%${q}%`), ilike(guests.email, `%${q}%`), ilike(guests.phone, `%${q}%`))!);
  }
  if (filters.show === "missing_email") conditions.push(isNull(guests.email));
  if (filters.show === "missing_phone") conditions.push(isNull(guests.phone));
  if (filters.show === "flagged") conditions.push(eq(guests.flagged, true));
  if (filters.show === "marketing") conditions.push(eq(guests.marketingOptIn, true));

  const kept = sql`${reservations.status} in ('confirmed', 'checked_in', 'checked_out')`;
  const stats = db
    .select({
      guestId: reservations.guestId,
      reservationCount: sql<number>`count(*)`.mapWith(Number).as("reservation_count"),
      stayCount: sql<number>`count(*) filter (where ${kept})`.mapWith(Number).as("stay_count"),
      nights: sql<number>`coalesce(sum(${reservations.checkOutDate} - ${reservations.checkInDate}) filter (where ${kept}), 0)`.mapWith(Number).as("nights"),
      inHouse: sql<boolean>`bool_or(${reservations.status} = 'checked_in')`.as("in_house"),
      nextCheckIn: sql<string | null>`min(${reservations.checkInDate}) filter (where ${reservations.status} in ('hold', 'confirmed'))`.as("next_check_in"),
      lastCheckOut: sql<string | null>`max(${reservations.checkOutDate}) filter (where ${reservations.status} = 'checked_out')`.as("last_check_out"),
      lastBookedAt: sql<Date | null>`max(${reservations.createdAt})`.as("last_booked_at"),
    })
    .from(reservations)
    .where(eq(reservations.organizationId, organizationId))
    .groupBy(reservations.guestId)
    .as("guest_stats");

  const spentCents = sql<number>`coalesce((
    select sum(${reservationCharges.amountCents}) from ${reservationCharges}
    inner join ${reservations} on ${reservations.id} = ${reservationCharges.reservationId}
      and ${reservations.organizationId} = ${reservationCharges.organizationId}
    where ${reservations.guestId} = ${guests.id}
      and ${reservations.organizationId} = ${guests.organizationId}
      and ${kept}
      and ${reservationCharges.type} <> 'security_deposit'
  ), 0)`.mapWith(Number);

  const order = {
    name: [asc(guests.name)],
    recent: [sql`${stats.lastBookedAt} desc nulls last`, asc(guests.name)],
    stays: [sql`coalesce(${stats.stayCount}, 0) desc`, asc(guests.name)],
    added: [desc(guests.createdAt)],
  }[filters.sort ?? "name"];

  const rows = await db
    .select({
      id: guests.id,
      name: guests.name,
      email: guests.email,
      phone: guests.phone,
      notes: guests.notes,
      tags: guests.tags,
      flagged: guests.flagged,
      flagReason: guests.flagReason,
      createdAt: guests.createdAt,
      reservationCount: sql<number>`coalesce(${stats.reservationCount}, 0)`.mapWith(Number),
      stayCount: sql<number>`coalesce(${stats.stayCount}, 0)`.mapWith(Number),
      nights: sql<number>`coalesce(${stats.nights}, 0)`.mapWith(Number),
      inHouse: sql<boolean>`coalesce(${stats.inHouse}, false)`.mapWith(Boolean),
      nextCheckIn: stats.nextCheckIn,
      lastCheckOut: stats.lastCheckOut,
      ...(filters.includeSpend ? { spentCents } : {}),
    })
    .from(guests)
    .leftJoin(stats, eq(stats.guestId, guests.id))
    .where(and(...conditions))
    .orderBy(...order);

  return rows.map((row) => ({ ...row, activity: guestActivity(row) }));
}

function guestActivity(row: { inHouse: boolean; nextCheckIn: string | null; lastCheckOut: string | null }): GuestActivity {
  if (row.inHouse) return "in_house";
  if (row.nextCheckIn) return "upcoming";
  if (row.lastCheckOut) return "past";
  return "no_stays";
}

export async function updateGuest(input: {
  organizationId: string;
  actorUserId: string;
  guestId: string;
  data: GuestProfileInput;
}) {
  const next = guestProfileValues(input.data);
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(guests)
      .where(and(eq(guests.id, input.guestId), eq(guests.organizationId, input.organizationId)))
      .limit(1);
    if (!existing) throw new ReservationError("Guest not found.", "guestId");
    // Field names only: ID numbers and similar never go into the audit log.
    const changed = (Object.keys(next) as (keyof typeof next)[]).filter((key) => JSON.stringify(next[key]) !== JSON.stringify(existing[key]));
    if (!changed.length) return existing;
    const [updated] = await tx
      .update(guests)
      .set({ ...next, updatedAt: new Date() })
      .where(eq(guests.id, existing.id))
      .returning();
    await recordAudit(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "guest",
      entityId: existing.id,
      action: "guest.updated",
      metadata: { fields: changed },
    });
    return updated!;
  });
}

/**
 * Delete a guest profile. Deleting would cascade to the guest's reservations
 * and their payment history, so only guests who never booked can go.
 */
export async function deleteGuest(input: { organizationId: string; actorUserId: string; guestId: string }) {
  return db.transaction(async (tx) => {
    const [guest] = await tx
      .select({ id: guests.id, name: guests.name })
      .from(guests)
      .where(and(eq(guests.id, input.guestId), eq(guests.organizationId, input.organizationId)))
      .for("update")
      .limit(1);
    if (!guest) throw new ReservationError("Guest not found.", "guestId");
    const [booking] = await tx
      .select({ id: reservations.id })
      .from(reservations)
      .where(and(eq(reservations.guestId, guest.id), eq(reservations.organizationId, input.organizationId)))
      .limit(1);
    if (booking) {
      throw new ReservationError("This guest has reservations, so their profile is kept for the booking history.");
    }
    await tx.delete(guests).where(eq(guests.id, guest.id));
    await recordAudit(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "guest",
      entityId: guest.id,
      action: "guest.deleted",
      metadata: { name: guest.name },
    });
  });
}

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------

export { buildDefaultCharges, computeTotals } from "@/lib/charges";

export interface ReservationListFilters {
  query?: string;
  status?: ReservationStatus;
  unitId?: string;
  guestId?: string;
  platformId?: string;
  /** Inclusive check-in date range. */
  startDate?: string;
  endDate?: string;
  /** "checkin" (latest stay first, the default) or "booked" (newest booking first). */
  sort?: "checkin" | "booked";
  /** Adds bookingTotalCents (charges excluding the deposit). Owner views only. */
  includeTotals?: boolean;
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
  if (filters.guestId) {
    conditions.push(eq(reservations.guestId, filters.guestId));
  }
  if (filters.platformId) {
    conditions.push(eq(reservations.platformId, filters.platformId));
  }
  if (filters.startDate) {
    conditions.push(gte(reservations.checkInDate, filters.startDate));
  }
  if (filters.endDate) {
    conditions.push(lte(reservations.checkInDate, filters.endDate));
  }

  // Correlated so each row carries its own charge total without a GROUP BY.
  const bookingTotalCents = sql<number>`coalesce((
    select sum(${reservationCharges.amountCents}) from ${reservationCharges}
    where ${reservationCharges.reservationId} = ${reservations.id}
      and ${reservationCharges.organizationId} = ${reservations.organizationId}
      and ${reservationCharges.type} <> 'security_deposit'
  ), 0)`.mapWith(Number);

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
      propertyName: properties.name,
      platformReference: reservations.platformReference,
      platformName: bookingPlatforms.name,
      platformLogoUrl: bookingPlatforms.logoUrl,
      platformColor: bookingPlatforms.color,
      ...(filters.includeTotals ? { bookingTotalCents } : {}),
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
    .leftJoin(
      properties,
      and(
        eq(units.propertyId, properties.id),
        eq(units.organizationId, properties.organizationId),
      ),
    )
    .leftJoin(
      bookingPlatforms,
      and(
        eq(reservations.platformId, bookingPlatforms.id),
        eq(reservations.organizationId, bookingPlatforms.organizationId),
      ),
    )
    .where(and(...conditions))
    .orderBy(
      ...(filters.sort === "booked"
        ? [desc(reservations.createdAt)]
        : [desc(reservations.checkInDate), desc(reservations.createdAt)]),
    );
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

  const [guest, reservationUnits, charges, transitions, tokens, occupants, platforms] = await Promise.all([
    getGuestOrThrow(organizationId, reservation.guestId),
    db
      .select()
      .from(units)
      .where(
        and(
          eq(units.id, reservation.unitId),
          eq(units.organizationId, organizationId),
        ),
      )
      .limit(1),
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
    db
      .select()
      .from(reservationOccupants)
      .where(and(
        eq(reservationOccupants.reservationId, reservationId),
        eq(reservationOccupants.organizationId, organizationId),
      ))
      .orderBy(asc(reservationOccupants.position)),
    reservation.platformId
      ? db
          .select()
          .from(bookingPlatforms)
          .where(and(eq(bookingPlatforms.id, reservation.platformId), eq(bookingPlatforms.organizationId, organizationId)))
          .limit(1)
      : Promise.resolve([]),
  ]);

  // Historical reservations must remain readable after their inventory is
  // archived. Booking flows still use getUnitOrThrow, which excludes deleted
  // units and prevents them from being selected for a new stay.
  const unit = reservationUnits[0];
  if (!unit) {
    throw new ReservationError("Reservation unit not found.", "unitId");
  }

  const property = await db
    .select()
    .from(properties)
    .where(
      and(
        eq(properties.id, unit.propertyId),
        eq(properties.organizationId, organizationId),
      ),
    )
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
    occupants,
    platform: platforms[0] ?? null,
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

export async function insertTransition(
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
  if (error instanceof Error && error.cause) return isUniqueViolation(error.cause);
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "23505"
  );
}

function isExclusionViolation(error: unknown): boolean {
  if (error instanceof Error && error.cause) return isExclusionViolation(error.cause);
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
      occupantNames: string[];
      platformId?: string;
      platformReference?: string;
      expiresAt: Date | null;
      confirmReason: string | null;
      initialPayment?: CreateConfirmedInput["initialPayment"];
      /** Confirmed bookings only: confirm even if the reservation fee isn't paid. */
      acknowledgeUnpaid?: boolean;
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

  let initialPayment: {
    amountCents: number;
    allocation: "booking" | "security_deposit";
    method: "gcash" | "maya" | "bank_transfer" | "cash";
    reference: string | null;
    receivedAt: Date;
  } | undefined;
  if (values.initialPayment) {
    let amountCents: number;
    try {
      amountCents = pesosToCentavos(values.initialPayment.amountPesos, { allowZero: false });
    } catch (error) {
      if (error instanceof MoneyParseError) throw new ReservationError(error.message, "paymentAmountPesos");
      throw error;
    }
    const [paymentProperty] = await db
      .select({ timezone: properties.timezone })
      .from(properties)
      .where(and(eq(properties.id, unit.propertyId), eq(properties.organizationId, organizationId)))
      .limit(1);
    const receivedAt = values.initialPayment.receivedAt
      ? localDateTimeToUtc(values.initialPayment.receivedAt, paymentProperty?.timezone ?? "Asia/Manila")
      : new Date();
    if (!receivedAt) throw new ReservationError("Use a valid payment date and time.", "paymentReceivedAt");
    initialPayment = {
      amountCents,
      allocation: values.initialPayment.allocation,
      method: values.initialPayment.method,
      reference: values.initialPayment.reference || null,
      receivedAt,
    };
  }

  // Expire stale holds (auto-commit) so the advisory check sees fresh state.
  const segments = (
    await getOccupancySegments(organizationId, [unit.id], values.checkIn, values.checkOut)
  ).get(unit.id) ?? [];
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

  const check = checkIntervalAvailability(segments, values.checkIn, values.checkOut);
  if (!check.available) {
    throw new ReservationError(
      `Those dates conflict with ${check.conflict.reason} (${check.conflict.startDate} → ${check.conflict.endDate}).`,
      "checkIn",
    );
  }
  const [property] = await db
    .select({ timezone: properties.timezone })
    .from(properties)
    .where(and(eq(properties.id, unit.propertyId), eq(properties.organizationId, organizationId)))
    .limit(1);
  const arrivalAt = property
    ? localDateTimeToUtc(`${values.checkIn}T${unit.checkInTime}`, property.timezone)
    : null;
  const turnoverConflict = arrivalAt ? findTurnoverArrivalConflict(segments, arrivalAt) : undefined;
  if (turnoverConflict) {
    throw new ReservationError(
      `The incoming arrival overlaps turnover until ${turnoverConflict.endTime}. Choose another arrival date.`,
      "checkIn",
    );
  }

  try {
    return await db.transaction(async (tx) => {
      // Stale holds must be expired in the same transaction before the
      // availability decision commits (PRD §5).
      await expireStaleHolds(tx, organizationId);

      // Serialize booking creation with unit deletion/status changes and
      // re-check bookability inside the authoritative transaction.
      const [lockedUnit] = await tx
        .select()
        .from(units)
        .where(and(
          eq(units.id, unit.id),
          eq(units.organizationId, organizationId),
          isNull(units.deletedAt),
        ))
        .limit(1)
        .for("update");
      if (!lockedUnit) {
        throw new ReservationError("This unit is no longer available.", "unitId");
      }
      assertBookableUnit(lockedUnit);
      const platform = await assertPlatform(tx, organizationId, values.platformId);
      const fee = applicableReservationFee(lockedUnit, platform);
      if (fee && args.status === "confirmed" && !values.acknowledgeUnpaid) {
        const requiredCents = reservationFeeCents(fee, computeTotals(values.charges).bookingTotalCents);
        const paidCents = initialPayment?.allocation === "booking" ? initialPayment.amountCents : 0;
        if (paidCents < requiredCents) {
          throw new ReservationError(
            `This unit needs a reservation fee of ${formatPHP(requiredCents)} before a booking is confirmed. Record it as the payment, or tick the acknowledgement to confirm anyway.`,
            "acknowledgeUnpaid",
          );
        }
      }

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
          reservationFeeType: fee?.type ?? null,
          reservationFeeAmount: fee?.amount ?? null,
          platformId: values.platformId ?? null,
          platformReference: values.platformReference || null,
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

      if (values.occupantNames.length > 0) {
        await tx.insert(reservationOccupants).values(
          values.occupantNames.map((name, position) => ({
            organizationId,
            reservationId: reservation.id,
            name,
            position,
          })),
        );
      }

      if (initialPayment) {
        const [payment] = await tx.insert(paymentEntries).values({
          organizationId,
          reservationId: reservation.id,
          allocation: initialPayment.allocation,
          amountCents: initialPayment.amountCents,
          method: initialPayment.method,
          reference: initialPayment.reference,
          receivedAt: initialPayment.receivedAt,
          recordedBy: actorUserId,
          idempotencyKey: args.idempotencyKey ? `reservation:${args.idempotencyKey}:payment` : null,
        }).returning({ id: paymentEntries.id });
        if (!payment) throw new ReservationError("Failed to record the initial payment.");
        await recordAudit(tx, {
          organizationId,
          actorUserId,
          entity: "payment_entry",
          entityId: payment.id,
          action: "payment.recorded",
          metadata: {
            reservationId: reservation.id,
            allocation: initialPayment.allocation,
            amountCents: initialPayment.amountCents,
            method: initialPayment.method,
            source: "reservation.created",
          },
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
          platformId: values.platformId ?? null,
          occupantCount: values.occupantNames.length,
        },
      });
      return reservation;
    });
  } catch (error) {
    if ((isUniqueViolation(error) || isExclusionViolation(error)) && args.idempotencyKey) {
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
    if (isExclusionViolation(error)) {
      throw new ReservationError(
        "Those dates are no longer available — another hold or booking overlaps them.",
        "checkIn",
      );
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
      occupantNames: data.occupantNames,
      platformId: data.platformId,
      platformReference: data.platformReference,
      expiresAt,
      confirmReason: null,
      initialPayment: undefined,
    },
  });
}

export async function createConfirmed(
  args: CreateReservationArgs & { data: CreateConfirmedInput },
) {
  const data = createConfirmedSchema.parse(args.data);
  const { bookingTotalCents } = computeTotals(data.charges);
  if (bookingTotalCents > 0 && !data.initialPayment && !data.acknowledgeUnpaid) {
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
      occupantNames: data.occupantNames,
      platformId: data.platformId,
      platformReference: data.platformReference,
      expiresAt: null,
      confirmReason: null,
      initialPayment: data.initialPayment,
      acknowledgeUnpaid: data.acknowledgeUnpaid,
    },
  });
}

/**
 * The reservation fee still owed on a booking: its rule's amount of the
 * current booking total, less booking payments net of refunds. Null when no
 * fee applies.
 */
async function reservationFeeOutstanding(
  executor: Tx | typeof db,
  reservation: typeof reservations.$inferSelect,
): Promise<{ requiredCents: number; outstandingCents: number } | null> {
  const rule = reservationFeeRule(reservation);
  if (!rule) return null;
  const scope = (table: typeof paymentEntries | typeof refundEntries) => and(
    eq(table.organizationId, reservation.organizationId),
    eq(table.reservationId, reservation.id),
    eq(table.allocation, "booking"),
  );
  const [charges, [paid], [refunded]] = await Promise.all([
    executor
      .select({ type: reservationCharges.type, description: reservationCharges.description, quantity: reservationCharges.quantity, unitAmountCents: reservationCharges.unitAmountCents })
      .from(reservationCharges)
      .where(and(eq(reservationCharges.organizationId, reservation.organizationId), eq(reservationCharges.reservationId, reservation.id))),
    executor.select({ cents: sql<number>`coalesce(sum(${paymentEntries.amountCents}), 0)::int` }).from(paymentEntries).where(scope(paymentEntries)),
    executor.select({ cents: sql<number>`coalesce(sum(${refundEntries.amountCents}), 0)::int` }).from(refundEntries).where(scope(refundEntries)),
  ]);
  const requiredCents = reservationFeeCents(rule, computeTotals(charges).bookingTotalCents);
  const netPaidCents = (paid?.cents ?? 0) - (refunded?.cents ?? 0);
  return { requiredCents, outstandingCents: Math.max(0, requiredCents - netPaidCents) };
}

/** The reservation fee required and still owed; null when none applies. */
export async function getReservationFeeStatus(organizationId: string, reservationId: string) {
  const [reservation] = await db
    .select()
    .from(reservations)
    .where(and(eq(reservations.id, reservationId), eq(reservations.organizationId, organizationId)))
    .limit(1);
  return reservation ? reservationFeeOutstanding(db, reservation) : null;
}

/**
 * Confirm a hold. Once the reservation fee is paid no reason is needed;
 * otherwise (or when the unit has no fee) the owner says why they're
 * confirming without it.
 */
export async function confirmHold(input: {
  organizationId: string;
  actorUserId: string;
  reservationId: string;
  reason?: string;
}) {
  const { reason } = confirmHoldSchema.parse({ reason: input.reason || undefined });

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
    const fee = await reservationFeeOutstanding(tx, reservation);
    const feePaid = fee !== null && fee.outstandingCents === 0;
    if (!feePaid && !reason) {
      throw new ReservationError(
        fee
          ? `The reservation fee has ${formatPHP(fee.outstandingCents)} left to pay. Give a reason to confirm without it.`
          : "Give a short reason for confirming without a recorded deposit.",
        "reason",
      );
    }

    const [updated] = await tx
      .update(reservations)
      .set({
        status: "confirmed",
        expiresAt: null,
        confirmReason: reason ?? null,
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
      note: reason
        ? `Confirmed without ${fee ? "the reservation fee" : "a recorded deposit"} — ${reason}`
        : "Confirmed — reservation fee paid.",
      actorUserId: input.actorUserId,
    });
    await recordAudit(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "reservation",
      entityId: reservation.id,
      action: "reservation.confirmed",
      metadata: { reason: reason ?? null, reservationFeeCents: fee?.requiredCents ?? null },
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

/**
 * The primary guest for an edited reservation: an existing guest, whose
 * contact details are updated when they changed (guest profiles are shared by
 * all of that guest's reservations), or a newly created guest.
 */
async function resolvePrimaryGuest(
  tx: Tx,
  organizationId: string,
  actorUserId: string,
  guestId: string | undefined,
  details: GuestInput | undefined,
): Promise<{ id: string }> {
  const contact = details ? { name: details.name, email: details.email || null, phone: details.phone || null } : null;
  if (!guestId) {
    const [created] = await tx.insert(guests).values({ organizationId, ...contact! }).returning({ id: guests.id, name: guests.name });
    if (!created) throw new ReservationError("Failed to create the guest.");
    await recordAudit(tx, { organizationId, actorUserId, entity: "guest", entityId: created.id, action: "guest.created", metadata: { name: created.name } });
    return created;
  }
  const [existing] = await tx.select().from(guests).where(and(eq(guests.id, guestId), eq(guests.organizationId, organizationId))).limit(1);
  if (!existing) throw new ReservationError("Primary guest not found.", "guestId");
  if (contact) {
    const changed = (Object.keys(contact) as (keyof typeof contact)[]).filter((key) => contact[key] !== existing[key]);
    if (changed.length) {
      await tx.update(guests).set({ ...contact, updatedAt: new Date() }).where(eq(guests.id, existing.id));
      await recordAudit(tx, { organizationId, actorUserId, entity: "guest", entityId: existing.id, action: "guest.updated", metadata: { fields: changed } });
    }
  }
  return existing;
}

/** Edit only a future hold or confirmed booking; financial snapshots remain immutable. */
export async function updateReservation(input: {
  organizationId: string;
  actorUserId: string;
  reservationId: string;
  data: UpdateReservationInput;
}) {
  const data = updateReservationSchema.parse(input.data);
  return db.transaction(async (tx) => {
    const [reservation] = await tx.select().from(reservations).where(and(eq(reservations.id, input.reservationId), eq(reservations.organizationId, input.organizationId))).limit(1);
    if (!reservation) throw new ReservationError("Reservation not found.", "reservationId");
    if (reservation.status !== "hold" && reservation.status !== "confirmed") {
      throw new ReservationError("Only a hold or confirmed reservation can be edited.");
    }
    const [unit] = await tx.select().from(units).where(and(eq(units.id, data.unitId), eq(units.organizationId, input.organizationId), isNull(units.deletedAt))).limit(1);
    if (!unit || data.guestCount > unit.capacity) throw new ReservationError(`This unit sleeps ${unit?.capacity ?? 0}; the guest count is too high.`, "guestCount");
    const platformId = data.platformId ?? reservation.platformId;
    const platform = await assertPlatform(tx, input.organizationId, platformId, reservation.platformId);
    // A different unit or platform means a different fee; otherwise the
    // booking keeps the rule it was made with.
    const fee = unit.id !== reservation.unitId || platformId !== reservation.platformId
      ? applicableReservationFee(unit, platform)
      : reservationFeeRule(reservation);
    const guest = await resolvePrimaryGuest(tx, input.organizationId, input.actorUserId, data.guestId, data.primaryGuest);
    const segments = (await getOccupancySegments(input.organizationId, [unit.id], data.checkIn, data.checkOut)).get(unit.id) ?? [];
    const availability = checkIntervalAvailability(segments.filter((segment) => segment.kind !== "reservation" || segment.id !== reservation.id), data.checkIn, data.checkOut);
    if (!availability.available) throw new ReservationError(`Those dates conflict with ${availability.conflict.reason}.`, "checkIn");
    const [updated] = await tx.update(reservations).set({ unitId: unit.id, guestId: guest.id, checkInDate: data.checkIn, checkOutDate: data.checkOut, guestCount: data.guestCount, platformId, platformReference: data.platformReference === undefined ? reservation.platformReference : data.platformReference || null, reservationFeeType: fee?.type ?? null, reservationFeeAmount: fee?.amount ?? null, updatedAt: new Date() }).where(eq(reservations.id, reservation.id)).returning();
    if (!updated) throw new ReservationError("Failed to update the reservation.");
    await tx.delete(reservationOccupants).where(and(eq(reservationOccupants.reservationId, reservation.id), eq(reservationOccupants.organizationId, input.organizationId)));
    if (data.occupantNames.length) await tx.insert(reservationOccupants).values(data.occupantNames.map((name, position) => ({ organizationId: input.organizationId, reservationId: reservation.id, name, position })));
    await tx.delete(reservationCharges).where(and(eq(reservationCharges.reservationId, reservation.id), eq(reservationCharges.organizationId, input.organizationId)));
    await tx.insert(reservationCharges).values(data.charges.map((line) => ({ organizationId: input.organizationId, reservationId: reservation.id, type: line.type, description: line.description, quantity: line.quantity, unitAmountCents: line.unitAmountCents, amountCents: line.quantity * line.unitAmountCents, isRefundableDeposit: line.type === "security_deposit" })));
    await recordAudit(tx, { organizationId: input.organizationId, actorUserId: input.actorUserId, entity: "reservation", entityId: reservation.id, action: "reservation.updated", metadata: { unitId: unit.id, guestId: guest.id, checkIn: data.checkIn, checkOut: data.checkOut, guestCount: data.guestCount, platformId: data.platformId ?? reservation.platformId, occupantCount: data.occupantNames.length, chargeCount: data.charges.length } });
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
