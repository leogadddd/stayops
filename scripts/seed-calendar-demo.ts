import "dotenv/config";

import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  auditEvents,
  guests,
  memberships,
  properties,
  reservations,
  unitBlocks,
  units,
  user,
} from "@/lib/db/schema";
import { addDaysLocal, nightsBetween, utcToLocalDateTimeParts } from "@/lib/dates";
import { addUnitBlock, createProperty, createUnit } from "@/server/inventory/service";
import { createConfirmed, createGuest, createHold, isLiveHold } from "@/server/reservations/service";
import { checkIn, checkOut } from "@/server/operations/service";
import { assertSafeDatabase, finishTurnover, removeReservations } from "./lib/sample-data";

/**
 * Calendar demo data for marketing screenshots: one property with one unit
 * ("Demo Suite 01"), a month of Filipino guest stays in September 2026, a
 * hold, GCash payments, and an aircon maintenance block.
 *
 *   npm run db:seed-calendar-demo            # create or top up (idempotent)
 *   npm run db:seed-calendar-demo -- --clean # permanently remove it all
 *
 * Only a local database is allowed unless --allow-remote is passed.
 * Guests use example.com emails and made-up +63 9XX numbers.
 */

const OWNER_EMAIL = "owner@stayops.dev";
const PROPERTY_NAME = "Makati Suites";
// Earlier runs used this name; it is renamed in place rather than duplicated.
const LEGACY_PROPERTY_NAMES = ["Demo Suites Makati"];
const UNIT_NAME = "Demo Suite 01";
const TIMEZONE = "Asia/Manila";
const CHECK_IN_TIME = "15:00";
const CHECK_OUT_TIME = "11:00";
const NIGHTLY_CENTAVOS = 250_000; // ₱2,500
const CLEANING_CENTAVOS = 50_000; // ₱500
const KEY_PREFIX = "calendar-demo";

type Target = "checked_out" | "checked_in" | "confirmed" | "hold";

interface DemoStay {
  key: string;
  guest: { name: string; email: string; phone: string };
  others: string[];
  checkIn: string;
  checkOut: string;
  target: Target;
  gcashReference?: string;
}

// Today is Sep 25, 2026: stays before today are checked out, Garcia is
// in-house and leaves today, later stays are upcoming.
const STAYS: DemoStay[] = [
  { key: "reyes", guest: { name: "Ana Reyes", email: "ana.reyes@example.com", phone: "+63 917 555 0141" }, others: ["Marco Reyes"], checkIn: "2026-09-03", checkOut: "2026-09-05", target: "checked_out", gcashReference: "GC-7K2M9Q41" },
  { key: "santos", guest: { name: "Miguel Santos", email: "miguel.santos@example.com", phone: "+63 918 555 0162" }, others: ["Rosa Santos", "Gabriel Santos", "Ella Santos"], checkIn: "2026-09-07", checkOut: "2026-09-10", target: "checked_out", gcashReference: "GC-3P8T5X27" },
  { key: "mendoza", guest: { name: "Carla Mendoza", email: "carla.mendoza@example.com", phone: "+63 927 555 0183" }, others: ["Joel Mendoza"], checkIn: "2026-09-12", checkOut: "2026-09-14", target: "checked_out", gcashReference: "GC-9H4W2B68" },
  { key: "villanueva", guest: { name: "Paolo Villanueva", email: "paolo.villanueva@example.com", phone: "+63 935 555 0124" }, others: ["Trisha Villanueva", "Nico Villanueva"], checkIn: "2026-09-17", checkOut: "2026-09-20", target: "checked_out", gcashReference: "GC-5R1N7D93" },
  { key: "garcia", guest: { name: "Bea Garcia", email: "bea.garcia@example.com", phone: "+63 945 555 0156" }, others: ["Lance Garcia"], checkIn: "2026-09-23", checkOut: "2026-09-25", target: "checked_in", gcashReference: "GC-2F6L8J35" },
  { key: "cruz", guest: { name: "Joshua Cruz", email: "joshua.cruz@example.com", phone: "+63 956 555 0178" }, others: ["Kim Cruz"], checkIn: "2026-09-26", checkOut: "2026-09-28", target: "hold" },
  { key: "bautista", guest: { name: "Liza Bautista", email: "liza.bautista@example.com", phone: "+63 966 555 0112" }, others: ["Ramon Bautista", "Sofia Bautista", "Diego Bautista", "Andrea Bautista"], checkIn: "2026-09-29", checkOut: "2026-10-01", target: "confirmed", gcashReference: "GC-8V3C6Z52" },
];

// Nights of Sep 15 and 16 (end date is exclusive).
const BLOCK = { startDate: "2026-09-15", endDate: "2026-09-17", reason: "Aircon maintenance" };

async function resolveOwner() {
  const [row] = await db
    .select({ userId: user.id, organizationId: memberships.organizationId })
    .from(user)
    .innerJoin(memberships, eq(memberships.userId, user.id))
    .where(and(eq(user.email, OWNER_EMAIL), eq(memberships.role, "owner")))
    .limit(1);
  if (!row) throw new Error(`No owner membership found for ${OWNER_EMAIL}. Run npm run db:seed first.`);
  return row;
}

async function findDemoProperty(organizationId: string) {
  const [property] = await db
    .select()
    .from(properties)
    .where(and(eq(properties.organizationId, organizationId), inArray(properties.name, [PROPERTY_NAME, ...LEGACY_PROPERTY_NAMES]), isNull(properties.deletedAt)))
    .limit(1);
  if (property && property.name !== PROPERTY_NAME) {
    const [renamed] = await db.update(properties).set({ name: PROPERTY_NAME, updatedAt: new Date() }).where(eq(properties.id, property.id)).returning();
    return renamed;
  }
  return property;
}

/** "YYYY-MM-DDTHH:mm" in Manila: 3 days before check-in at 10:00, never later than now. */
function paymentReceivedAt(checkInDate: string): string {
  const planned = `${addDaysLocal(checkInDate, -3)}T10:00`;
  const now = utcToLocalDateTimeParts(new Date(Date.now() - 60_000), TIMEZONE);
  const nowLocal = `${now.date}T${now.time}`;
  return planned < nowLocal ? planned : nowLocal;
}

function chargesFor(stay: DemoStay) {
  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  return [
    { type: "accommodation" as const, description: `Accommodation (${nights} night${nights === 1 ? "" : "s"})`, quantity: nights, unitAmountCents: NIGHTLY_CENTAVOS },
    { type: "cleaning" as const, description: "Cleaning fee", quantity: 1, unitAmountCents: CLEANING_CENTAVOS },
  ];
}

async function ensureGuest(organizationId: string, actorUserId: string, stay: DemoStay) {
  const [existing] = await db
    .select({ id: guests.id })
    .from(guests)
    .where(and(eq(guests.organizationId, organizationId), eq(guests.email, stay.guest.email)))
    .limit(1);
  if (existing) return existing.id;
  const created = await createGuest({ organizationId, actorUserId, data: { ...stay.guest, notes: "Calendar demo guest (fictional)." } });
  return created.id;
}

async function seed() {
  const owner = await resolveOwner();
  const ctx = { organizationId: owner.organizationId, actorUserId: owner.userId };

  const property = (await findDemoProperty(ctx.organizationId)) ?? await createProperty({
    ...ctx,
    data: { name: PROPERTY_NAME, address: "Makati, Metro Manila", timezone: TIMEZONE, checkInTime: CHECK_IN_TIME, checkOutTime: CHECK_OUT_TIME, turnoverDurationMinutes: 120, houseRules: "No smoking inside. Quiet hours after 10pm." },
  });
  console.log(`Property: ${property.name}`);

  const [existingUnit] = await db
    .select()
    .from(units)
    .where(and(eq(units.organizationId, ctx.organizationId), eq(units.propertyId, property.id), eq(units.name, UNIT_NAME), isNull(units.deletedAt)))
    .limit(1);
  const unit = existingUnit ?? await createUnit({
    ...ctx,
    propertyId: property.id,
    data: { name: UNIT_NAME, capacity: 6, bedrooms: 2, bathrooms: 1, defaultNightlyRateCents: NIGHTLY_CENTAVOS, cleaningFeeCents: CLEANING_CENTAVOS, securityDepositCents: null, checkInTime: CHECK_IN_TIME, checkOutTime: CHECK_OUT_TIME, status: "active" },
  });
  console.log(`Unit: ${unit.name}`);

  const [existingBlock] = await db
    .select({ id: unitBlocks.id })
    .from(unitBlocks)
    .where(and(eq(unitBlocks.unitId, unit.id), eq(unitBlocks.startDate, BLOCK.startDate), eq(unitBlocks.endDate, BLOCK.endDate)))
    .limit(1);
  if (!existingBlock) await addUnitBlock({ ...ctx, unitId: unit.id, data: BLOCK });
  console.log(`Block: ${BLOCK.reason} (${BLOCK.startDate} → ${BLOCK.endDate})`);

  for (const stay of STAYS) {
    const guestId = await ensureGuest(ctx.organizationId, ctx.actorUserId, stay);
    const idempotencyKey = `${KEY_PREFIX}:${stay.key}`;
    const base = { unitId: unit.id, checkIn: stay.checkIn, checkOut: stay.checkOut, guestCount: 1 + stay.others.length, occupantNames: stay.others, charges: chargesFor(stay) };

    let reservation;
    if (stay.target === "hold") {
      const [existing] = await db.select().from(reservations).where(and(eq(reservations.organizationId, ctx.organizationId), eq(reservations.idempotencyKey, idempotencyKey))).limit(1);
      // An expired hold is replaced so a rerun always shows a live ~24h hold.
      if (existing && !isLiveHold(existing.status, existing.expiresAt)) {
        await removeReservations([existing.id]);
      }
      reservation = await createHold({ ...ctx, guest: { guestId }, idempotencyKey, data: { ...base, holdMinutes: 24 * 60 } });
    } else {
      const total = nightsBetween(stay.checkIn, stay.checkOut) * NIGHTLY_CENTAVOS + CLEANING_CENTAVOS;
      reservation = await createConfirmed({
        ...ctx,
        guest: { guestId },
        idempotencyKey,
        data: {
          ...base,
          initialPayment: { amountPesos: String(total / 100), allocation: "booking", method: "gcash", reference: stay.gcashReference, receivedAt: paymentReceivedAt(stay.checkIn) },
        },
      });
      if (stay.target !== "confirmed" && reservation.status === "confirmed") {
        reservation = await checkIn({ ...ctx, reservationId: reservation.id, data: { note: "Guest checked in." } });
      }
      if (stay.target === "checked_out" && reservation.status === "checked_in") {
        ({ reservation } = await checkOut({ ...ctx, reservationId: reservation.id, data: { note: "Guest checked out.", actualCheckoutAt: `${stay.checkOut}T${CHECK_OUT_TIME}` } }));
      }
      // Past stays were cleaned, so their turnovers don't read as a backlog.
      if (stay.target === "checked_out") await finishTurnover(ctx, reservation.id);
    }
    console.log(`  ${stay.guest.name.padEnd(17)} ${stay.checkIn} → ${stay.checkOut}  ${reservation.status}`);
  }
}

async function clean() {
  const owner = await resolveOwner();
  const property = await findDemoProperty(owner.organizationId);
  const demoGuests = await db
    .select({ id: guests.id })
    .from(guests)
    .where(and(eq(guests.organizationId, owner.organizationId), inArray(guests.email, STAYS.map((stay) => stay.guest.email))));
  const guestIds = demoGuests.map((row) => row.id);
  const unitIds = property
    ? (await db.select({ id: units.id }).from(units).where(eq(units.propertyId, property.id))).map((row) => row.id)
    : [];
  // Never fall back to an unfiltered query: with no demo units or guests,
  // there are no demo reservations to remove.
  const scope = [
    ...(unitIds.length ? [inArray(reservations.unitId, unitIds)] : []),
    ...(guestIds.length ? [inArray(reservations.guestId, guestIds)] : []),
  ];
  const reservationIds = scope.length
    ? (await db
      .select({ id: reservations.id })
      .from(reservations)
      .where(and(eq(reservations.organizationId, owner.organizationId), or(...scope))))
      .map((row) => row.id)
    : [];
  if (!property && !guestIds.length) {
    console.log("No calendar demo data found.");
    return;
  }
  // Only this script's reservations should reference the demo guests.
  await removeReservations(reservationIds);
  const blockIds = unitIds.length
    ? (await db.select({ id: unitBlocks.id }).from(unitBlocks).where(inArray(unitBlocks.unitId, unitIds))).map((row) => row.id)
    : [];
  await db.transaction(async (tx) => {
    const ids = [...guestIds, ...unitIds, ...blockIds, ...(property ? [property.id] : [])];
    if (ids.length) await tx.delete(auditEvents).where(inArray(auditEvents.entityId, ids));
    if (guestIds.length) await tx.delete(guests).where(inArray(guests.id, guestIds));
    // Units, unit blocks and remaining tasks cascade from the property.
    if (property) await tx.delete(properties).where(eq(properties.id, property.id));
  });
  console.log(`Removed ${PROPERTY_NAME}, ${reservationIds.length} reservations and ${guestIds.length} guests.`);
}

async function main() {
  assertSafeDatabase();
  if (process.argv.includes("--clean")) await clean();
  else await seed();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
