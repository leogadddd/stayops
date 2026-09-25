import "server-only";

import { and, eq, gt, inArray, lt, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { guests, properties, reservations, turnoverBlocks, unitBlocks, units } from "@/lib/db/schema";
import { addDaysLocal, listNights, utcToLocalDateTimeParts } from "@/lib/dates";
import { expireStaleHolds } from "@/server/reservations/holds";

/**
 * An occupied run of nights on a unit: either an out-of-service block or a
 * hold/reservation. The pure helpers below key off `kind`, so UI code can
 * render holds and bookings differently without touching the overlap math.
 */
export type OccupancySegment =
  | {
      kind: "turnover";
      id: string;
      reservationId: string;
      taskId: string;
      startDate: string;
      endDate: string;
      startTime: string;
      endTime: string;
      startsAt: Date;
      endsAt: Date;
    }
  | {
      kind: "block";
      id: string;
      startDate: string; // yyyy-mm-dd, inclusive
      endDate: string; // yyyy-mm-dd, exclusive
      reason: string;
    }
  | {
      kind: "reservation";
      id: string;
      startDate: string;
      endDate: string;
      status: "hold" | "confirmed" | "checked_in" | "checked_out";
      guestName: string;
      expiresAt: Date | null;
      guestCount?: number;
      actualCheckoutAt?: Date | null;
    };

export type NightStatus =
  | { kind: "available" }
  | { kind: "blocked"; reason: string; segmentId: string }
  | {
      kind: "held";
      guestName: string;
      expiresAt: Date | null;
      segmentId: string;
    }
  | {
      kind: "booked";
      guestName: string;
      status: "confirmed" | "checked_in" | "checked_out";
      segmentId: string;
    };

export type IntervalCheck =
  | { available: true; nights: string[] }
  | {
      available: false;
      conflict: { startDate: string; endDate: string; reason: string };
    };

function reservationReason(segment: Extract<OccupancySegment, { kind: "reservation" }>): string {
  return segment.status === "hold"
    ? `Hold for ${segment.guestName}`
    : `Booking for ${segment.guestName}`;
}

/**
 * Fetch out-of-service blocks and live reservation occupancy overlapping
 * [rangeStart, rangeEnd) for the given units. Stale holds are expired first
 * so this never reports dates that a confirm/create would refuse.
 */
export async function getOccupancySegments(
  organizationId: string,
  unitIds: string[],
  rangeStart: string,
  rangeEnd: string,
): Promise<Map<string, OccupancySegment[]>> {
  await expireStaleHolds(db, organizationId);

  const segments = new Map<string, OccupancySegment[]>();
  for (const unitId of unitIds) {
    segments.set(unitId, []);
  }
  if (unitIds.length === 0) return segments;

  const blockRows = await db
    .select({
      id: unitBlocks.id,
      unitId: unitBlocks.unitId,
      startDate: unitBlocks.startDate,
      endDate: unitBlocks.endDate,
      reason: unitBlocks.reason,
    })
    .from(unitBlocks)
    .where(
      and(
        eq(unitBlocks.organizationId, organizationId),
        inArray(unitBlocks.unitId, unitIds),
        lt(unitBlocks.startDate, rangeEnd),
        gt(unitBlocks.endDate, rangeStart),
      ),
    );

  const reservationRows = await db
    .select({
      id: reservations.id,
      unitId: reservations.unitId,
      startDate: reservations.checkInDate,
      endDate: reservations.checkOutDate,
      status: reservations.status,
      guestName: guests.name,
      expiresAt: reservations.expiresAt,
      guestCount: reservations.guestCount,
      actualCheckoutAt: reservations.actualCheckoutAt,
    })
    .from(reservations)
    .innerJoin(
      guests,
      and(
        eq(reservations.guestId, guests.id),
        eq(reservations.organizationId, guests.organizationId),
      ),
    )
    .where(
      and(
        eq(reservations.organizationId, organizationId),
        inArray(reservations.unitId, unitIds),
        lt(reservations.checkInDate, rangeEnd),
        gt(reservations.checkOutDate, rangeStart),
        or(
          inArray(reservations.status, [
            "confirmed",
            "checked_in",
            "checked_out",
          ]),
          and(
            eq(reservations.status, "hold"),
            gt(reservations.expiresAt, new Date()),
          ),
        ),
      ),
    );

  // Include timestamped automatic turnover blocks for the visible calendar
  // range. These are not date occupancy and are intentionally excluded from
  // night availability below.
  const turnoverRows = await db
    .select({
      id: turnoverBlocks.id,
      unitId: turnoverBlocks.unitId,
      reservationId: turnoverBlocks.reservationId,
      taskId: turnoverBlocks.taskId,
      startsAt: turnoverBlocks.startsAt,
      endsAt: turnoverBlocks.endsAt,
      timezone: properties.timezone,
    })
    .from(turnoverBlocks)
    .innerJoin(units, and(eq(turnoverBlocks.unitId, units.id), eq(turnoverBlocks.organizationId, units.organizationId)))
    .innerJoin(properties, and(eq(units.propertyId, properties.id), eq(units.organizationId, properties.organizationId)))
    .where(and(
      eq(turnoverBlocks.organizationId, organizationId),
      inArray(turnoverBlocks.unitId, unitIds),
      // A coarse UTC date window is expanded either side to preserve every
      // possible property-local timestamp in the requested dates.
      lt(turnoverBlocks.startsAt, new Date(`${addDaysLocal(rangeEnd, 1)}T12:00:00Z`)),
      gt(turnoverBlocks.endsAt, new Date(`${addDaysLocal(rangeStart, -1)}T12:00:00Z`)),
    ));

  for (const row of blockRows) {
    segments.get(row.unitId)?.push({
      kind: "block",
      id: row.id,
      startDate: row.startDate,
      endDate: row.endDate,
      reason: row.reason,
    });
  }
  for (const row of reservationRows) {
    // The WHERE clause above restricts status to the four active values.
    const status = row.status as
      | "hold"
      | "confirmed"
      | "checked_in"
      | "checked_out";
    segments.get(row.unitId)?.push({
      kind: "reservation",
      id: row.id,
      startDate: row.startDate,
      endDate: row.endDate,
      status,
      guestName: row.guestName,
      expiresAt: row.expiresAt,
      guestCount: row.guestCount,
      actualCheckoutAt: row.actualCheckoutAt,
    });
  }
  for (const row of turnoverRows) {
    const start = utcToLocalDateTimeParts(row.startsAt, row.timezone);
    const end = utcToLocalDateTimeParts(row.endsAt, row.timezone);
    segments.get(row.unitId)?.push({
      kind: "turnover",
      id: row.id,
      reservationId: row.reservationId,
      taskId: row.taskId,
      startDate: start.date,
      // The date layout is end-exclusive, so retain the local day containing
      // the endpoint even for turnovers that cross midnight.
      endDate: addDaysLocal(end.date, 1),
      startTime: start.time,
      endTime: end.time,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
    });
  }
  return segments;
}

// Check hold expiry here too, because the concurrent expiry sweep may not have finished.
export async function listCalendarActivity(
  organizationId: string,
  unitDays: readonly { unitId: string; today: string }[],
) {
  if (unitDays.length === 0) return [];
  return db
    .select({
      id: reservations.id,
      unitId: reservations.unitId,
      startDate: reservations.checkInDate,
      endDate: reservations.checkOutDate,
      status: reservations.status,
      guestName: guests.name,
      guestCount: reservations.guestCount,
      expiresAt: reservations.expiresAt,
    })
    .from(reservations)
    .innerJoin(
      guests,
      and(
        eq(reservations.guestId, guests.id),
        eq(reservations.organizationId, guests.organizationId),
      ),
    )
    .where(and(
      eq(reservations.organizationId, organizationId),
      inArray(reservations.unitId, unitDays.map(({ unitId }) => unitId)),
      or(
        and(eq(reservations.status, "hold"), gt(reservations.expiresAt, new Date())),
        and(
          inArray(reservations.status, ["confirmed", "checked_in", "checked_out"]),
          or(...unitDays.map(({ unitId, today }) => and(
            eq(reservations.unitId, unitId),
            or(eq(reservations.checkInDate, today), eq(reservations.checkOutDate, today)),
          ))),
        ),
      ),
    ))
    .orderBy(reservations.checkInDate, reservations.id);
}

/**
 * Per-night availability for a half-open range. Nights outside segment ranges
 * are available; the earliest overlapping segment wins a contested night.
 */
export function buildNightStatusMap(
  rangeStart: string,
  rangeEnd: string,
  segments: readonly OccupancySegment[],
): Map<string, NightStatus> {
  const map = new Map<string, NightStatus>();
  for (const night of listNights(rangeStart, rangeEnd)) {
    map.set(night, { kind: "available" });
  }
  const ordered = [...segments].sort((a, b) =>
    a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0,
  );
  for (const segment of ordered) {
    const overlapStart =
      segment.startDate < rangeStart ? rangeStart : segment.startDate;
    const overlapEnd = segment.endDate > rangeEnd ? rangeEnd : segment.endDate;
    if (overlapStart >= overlapEnd) continue;
    for (const night of listNights(overlapStart, overlapEnd)) {
      if (map.get(night)?.kind !== "available") continue;
      if (segment.kind === "turnover") continue;
      if (segment.kind === "block") {
        map.set(night, {
          kind: "blocked",
          reason: segment.reason,
          segmentId: segment.id,
        });
      } else if (segment.status === "hold") {
        map.set(night, {
          kind: "held",
          guestName: segment.guestName,
          expiresAt: segment.expiresAt,
          segmentId: segment.id,
        });
      } else {
        map.set(night, {
          kind: "booked",
          guestName: segment.guestName,
          status: segment.status,
          segmentId: segment.id,
        });
      }
    }
  }
  return map;
}

/**
 * The authoritative interval check used by booking operations: a unit is
 * available only when no segment intersects [checkIn, checkOut).
 */
export function checkIntervalAvailability(
  segments: readonly OccupancySegment[],
  checkIn: string,
  checkOut: string,
): IntervalCheck {
  const conflict = segments
    .filter(
      (segment) => segment.kind !== "turnover" && segment.startDate < checkOut && checkIn < segment.endDate,
    )
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))[0];

  if (conflict) {
    return {
      available: false,
      conflict: {
        startDate: conflict.startDate,
        endDate: conflict.endDate,
        reason:
          conflict.kind === "block"
            ? conflict.reason
            : conflict.kind === "turnover"
              ? "Turnover"
            : reservationReason(conflict),
      },
    };
  }
  return { available: true, nights: listNights(checkIn, checkOut) };
}

/** Turnover only conflicts when the incoming stay's actual arrival overlaps it. */
export function findTurnoverArrivalConflict(
  segments: readonly OccupancySegment[],
  arrivalAt: Date,
) {
  return segments.find(
    (segment): segment is Extract<OccupancySegment, { kind: "turnover" }> =>
      segment.kind === "turnover" && segment.startsAt <= arrivalAt && arrivalAt < segment.endsAt,
  );
}
