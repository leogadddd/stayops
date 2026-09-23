import "server-only";

import { and, gt, inArray, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { unitBlocks } from "@/lib/db/schema";
import { listNights } from "@/lib/dates";

/**
 * An occupied run of nights on a unit. Slice 2 adds `kind: "reservation"`
 * segments alongside blocks; the pure helpers below already key off `kind`,
 * so nothing here needs to change when that lands.
 */
export type OccupancySegment = {
  kind: "block";
  id: string;
  startDate: string; // yyyy-mm-dd, inclusive
  endDate: string; // yyyy-mm-dd, exclusive
  reason: string;
};

export type NightStatus =
  | { kind: "available" }
  | { kind: "blocked"; reason: string; segmentId: string };

export type IntervalCheck =
  | { available: true; nights: string[] }
  | {
      available: false;
      conflict: { startDate: string; endDate: string; reason: string };
    };

/**
 * Fetch out-of-service segments overlapping [rangeStart, rangeEnd) for the
 * given units. Reservation occupancy merges into this same shape in slice 2.
 */
export async function getOccupancySegments(
  organizationId: string,
  unitIds: string[],
  rangeStart: string,
  rangeEnd: string,
): Promise<Map<string, OccupancySegment[]>> {
  const segments = new Map<string, OccupancySegment[]>();
  for (const unitId of unitIds) {
    segments.set(unitId, []);
  }
  if (unitIds.length === 0) return segments;

  const rows = await db
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
        inArray(unitBlocks.unitId, unitIds),
        lt(unitBlocks.startDate, rangeEnd),
        gt(unitBlocks.endDate, rangeStart),
      ),
    );

  for (const row of rows) {
    segments.get(row.unitId)?.push({
      kind: "block",
      id: row.id,
      startDate: row.startDate,
      endDate: row.endDate,
      reason: row.reason,
    });
  }
  return segments;
}

/**
 * Per-night availability for a half-open range. Nights outside segment ranges
 * are available; the earliest overlapping segment wins a blocked night.
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
    const overlapStart = segment.startDate < rangeStart ? rangeStart : segment.startDate;
    const overlapEnd = segment.endDate > rangeEnd ? rangeEnd : segment.endDate;
    if (overlapStart >= overlapEnd) continue;
    for (const night of listNights(overlapStart, overlapEnd)) {
      if (map.get(night)?.kind === "blocked") continue;
      map.set(night, {
        kind: "blocked",
        reason: segment.reason,
        segmentId: segment.id,
      });
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
      (segment) => segment.startDate < checkOut && checkIn < segment.endDate,
    )
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))[0];

  if (conflict) {
    return {
      available: false,
      conflict: {
        startDate: conflict.startDate,
        endDate: conflict.endDate,
        reason: conflict.reason,
      },
    };
  }
  return { available: true, nights: listNights(checkIn, checkOut) };
}
