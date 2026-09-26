import "dotenv/config";

import { and, asc, eq, ilike, inArray, isNull, like } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditEvents, guests, memberships, organizations, properties, reservations, units } from "@/lib/db/schema";
import { buildDefaultCharges, computeTotals } from "@/lib/charges";
import { addDaysLocal, todayInTimeZone, utcToLocalDateTimeParts } from "@/lib/dates";
import { createConfirmed, createGuest, createHold, isLiveHold } from "@/server/reservations/service";
import { ReservationError } from "@/server/reservations/validation";
import { InventoryError } from "@/server/inventory/validation";
import { checkIn, checkOut, OperationsError } from "@/server/operations/service";
import { assertSafeDatabase, finishTurnover, removeReservations } from "./lib/sample-data";

/**
 * Sample reservations for one organization, found by name, so its
 * dashboard, calendar and reservations have something to show. Each active
 * unit gets a spread of stays around today: two past (checked out), one in
 * house, two upcoming (confirmed) and a live hold. Guests are fictional
 * (example.com emails, made-up +63 numbers).
 *
 *   npm run seed:reservations -- "Casa Yohan Yarn"           # create or top up
 *   npm run seed:reservations -- "Casa Yohan Yarn" --dry-run # show the plan only
 *   npm run seed:reservations -- "Casa Yohan Yarn" --clean   # remove them again
 *
 * The name matches exactly (ignoring case) or, failing that, as part of a
 * name. Reruns are safe: each stay has an idempotency key, and dates that
 * clash with real bookings or blocks are skipped. Only a local database is
 * allowed unless --allow-remote is passed.
 */

const KEY_PREFIX = "sample";
const GUEST_EMAIL_PREFIX = "sample.";
// Used when a unit has no nightly rate yet, so payments have an amount.
const FALLBACK_NIGHTLY_CENTAVOS = 250_000;

type Target = "checked_out" | "checked_in" | "confirmed" | "hold";

/** Stays relative to today: [first night offset, nights, target]. */
const PLAN: [number, number, Target][] = [
  [-12, 2, "checked_out"],
  [-6, 3, "checked_out"],
  [-1, 2, "checked_in"],
  [3, 2, "confirmed"],
  [7, 1, "hold"],
  [11, 3, "confirmed"],
];

const GUESTS = [
  { name: "Ana Reyes", phone: "+63 917 555 0141", others: ["Marco Reyes"] },
  { name: "Miguel Santos", phone: "+63 918 555 0162", others: ["Rosa Santos", "Gabriel Santos"] },
  { name: "Carla Mendoza", phone: "+63 927 555 0183", others: ["Joel Mendoza"] },
  { name: "Paolo Villanueva", phone: "+63 935 555 0124", others: [] },
  { name: "Bea Garcia", phone: "+63 945 555 0156", others: ["Lance Garcia"] },
  { name: "Joshua Cruz", phone: "+63 956 555 0178", others: ["Kim Cruz", "Ella Cruz"] },
  { name: "Liza Bautista", phone: "+63 966 555 0112", others: ["Ramon Bautista"] },
  { name: "Rico Dizon", phone: "+63 977 555 0133", others: [] },
  { name: "Tina Aquino", phone: "+63 908 555 0199", others: ["Jun Aquino", "Mika Aquino"] },
  { name: "Noel Ramos", phone: "+63 919 555 0107", others: ["Grace Ramos"] },
];

function args() {
  const flags = new Set(process.argv.slice(2).filter((arg) => arg.startsWith("--")));
  const name = process.argv.slice(2).filter((arg) => !arg.startsWith("--")).join(" ").trim();
  return { name, dryRun: flags.has("--dry-run"), clean: flags.has("--clean") };
}

function guestEmail(name: string) {
  return `${GUEST_EMAIL_PREFIX}${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`;
}

async function findOrganization(name: string) {
  const exact = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(ilike(organizations.name, name.replace(/[%_\\]/g, "\\$&")));
  if (exact.length === 1) return exact[0]!;
  const partial = exact.length
    ? exact
    : await db
        .select({ id: organizations.id, name: organizations.name })
        .from(organizations)
        .where(ilike(organizations.name, `%${name.replace(/[%_\\]/g, "\\$&")}%`))
        .orderBy(asc(organizations.name));
  if (partial.length === 1) return partial[0]!;
  if (partial.length > 1) {
    throw new Error(`"${name}" matches ${partial.length} organizations: ${partial.map((org) => `"${org.name}"`).join(", ")}. Use the full name.`);
  }
  const all = await db.select({ name: organizations.name }).from(organizations).orderBy(asc(organizations.name)).limit(20);
  throw new Error(`No organization named "${name}". Available: ${all.map((org) => `"${org.name}"`).join(", ") || "none"}.`);
}

async function findOwner(organizationId: string) {
  const [owner] = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(and(eq(memberships.organizationId, organizationId), eq(memberships.role, "owner")))
    .orderBy(asc(memberships.createdAt))
    .limit(1);
  if (!owner) throw new Error("That organization has no owner to record the reservations as.");
  return owner.userId;
}

async function ensureGuest(ctx: { organizationId: string; actorUserId: string }, guest: (typeof GUESTS)[number]) {
  const email = guestEmail(guest.name);
  const [existing] = await db
    .select({ id: guests.id })
    .from(guests)
    .where(and(eq(guests.organizationId, ctx.organizationId), eq(guests.email, email)))
    .limit(1);
  if (existing) return existing.id;
  const created = await createGuest({
    ...ctx,
    data: { name: guest.name, email, phone: guest.phone, notes: "Sample guest (fictional)." },
  });
  return created.id;
}

/** "YYYY-MM-DDTHH:mm" local: two days before check-in at 10:00, never later than now. */
function paymentReceivedAt(checkInDate: string, timeZone: string) {
  const planned = `${addDaysLocal(checkInDate, -2)}T10:00`;
  const now = utcToLocalDateTimeParts(new Date(Date.now() - 60_000), timeZone);
  const nowLocal = `${now.date}T${now.time}`;
  return planned < nowLocal ? planned : nowLocal;
}

async function seed(organization: { id: string; name: string }, dryRun: boolean) {
  const actorUserId = await findOwner(organization.id);
  const ctx = { organizationId: organization.id, actorUserId };
  const activeUnits = await db
    .select({ unit: units, timezone: properties.timezone, propertyName: properties.name })
    .from(units)
    .innerJoin(properties, eq(units.propertyId, properties.id))
    .where(and(eq(units.organizationId, organization.id), eq(units.status, "active"), isNull(units.deletedAt), isNull(properties.deletedAt)))
    .orderBy(asc(properties.name), asc(units.name));
  if (!activeUnits.length) {
    throw new Error(`"${organization.name}" has no active units. Add a property and an active unit first.`);
  }

  let created = 0;
  let skipped = 0;
  let guestIndex = 0;
  for (const [unitIndex, { unit, timezone, propertyName }] of activeUnits.entries()) {
    console.log(`\n${propertyName} · ${unit.name}`);
    const today = todayInTimeZone(timezone);
    for (const [planIndex, [offset, nights, target]] of PLAN.entries()) {
      // Stagger units by a day so the calendar doesn't show identical rows.
      const shift = target === "checked_in" ? 0 : unitIndex % 2;
      const stayCheckIn = addDaysLocal(today, offset + shift);
      const stayCheckOut = addDaysLocal(stayCheckIn, nights);
      const guest = GUESTS[guestIndex++ % GUESTS.length]!;
      const label = `  ${guest.name.padEnd(17)} ${stayCheckIn} → ${stayCheckOut}  ${target}`;
      if (dryRun) {
        console.log(label);
        continue;
      }

      const idempotencyKey = `${KEY_PREFIX}:${unit.id}:${planIndex}`;
      const charges = buildDefaultCharges({
        nightlyRateCents: unit.defaultNightlyRateCents || FALLBACK_NIGHTLY_CENTAVOS,
        dayRates: unit.defaultNightlyRateCents ? unit.dayRates : null,
        checkIn: stayCheckIn,
        nights,
        cleaningFeeCents: unit.cleaningFeeCents,
        securityDepositCents: unit.securityDepositCents,
      });
      const base = {
        unitId: unit.id,
        checkIn: stayCheckIn,
        checkOut: stayCheckOut,
        guestCount: Math.min(unit.capacity, 1 + guest.others.length),
        occupantNames: guest.others.slice(0, Math.max(0, unit.capacity - 1)),
        charges,
      };

      try {
        const guestId = await ensureGuest(ctx, guest);
        let reservation;
        if (target === "hold") {
          const [existing] = await db
            .select()
            .from(reservations)
            .where(and(eq(reservations.organizationId, ctx.organizationId), eq(reservations.idempotencyKey, idempotencyKey)))
            .limit(1);
          // An expired hold is replaced so a rerun always shows a live one.
          if (existing && !isLiveHold(existing.status, existing.expiresAt)) await removeReservations([existing.id]);
          reservation = await createHold({ ...ctx, guest: { guestId }, idempotencyKey, data: { ...base, holdMinutes: 24 * 60 } });
        } else {
          const { bookingTotalCents } = computeTotals(charges);
          reservation = await createConfirmed({
            ...ctx,
            guest: { guestId },
            idempotencyKey,
            data: {
              ...base,
              initialPayment: {
                amountPesos: String(bookingTotalCents / 100),
                allocation: "booking",
                method: "gcash",
                reference: `GC-SAMPLE-${String(planIndex + 1).padStart(2, "0")}${String(unitIndex + 1).padStart(2, "0")}`,
                receivedAt: paymentReceivedAt(stayCheckIn, timezone),
              },
            },
          });
          if (target !== "confirmed" && reservation.status === "confirmed") {
            reservation = await checkIn({ ...ctx, reservationId: reservation.id, data: { note: "Sample: guest checked in." } });
          }
          if (target === "checked_out" && reservation.status === "checked_in") {
            ({ reservation } = await checkOut({
              ...ctx,
              reservationId: reservation.id,
              data: { note: "Sample: guest checked out.", actualCheckoutAt: `${stayCheckOut}T${unit.checkOutTime}` },
            }));
          }
        }
        // Past stays were cleaned, so their turnovers don't read as a backlog.
        // A unit with open damage can't be marked ready; leave that one open.
        let note = "";
        if (target === "checked_out") {
          try {
            await finishTurnover(ctx, reservation.id);
          } catch (error) {
            if (!(error instanceof OperationsError)) throw error;
            note = ` (turnover left open: ${error.message.split(".")[0]})`;
          }
        }
        created++;
        console.log(`${label.padEnd(66)} ✓ ${reservation.status}${note}`);
      } catch (error) {
        if (!(error instanceof ReservationError || error instanceof InventoryError)) throw error;
        skipped++;
        console.log(`${label.padEnd(66)} skipped: ${error.message}`);
      }
    }
  }
  if (dryRun) console.log("\nDry run: nothing was written.");
  else console.log(`\nDone: ${created} reservation(s) created or already there, ${skipped} skipped.`);
}

async function clean(organization: { id: string; name: string }) {
  const sampleReservations = await db
    .select({ id: reservations.id })
    .from(reservations)
    .where(and(eq(reservations.organizationId, organization.id), like(reservations.idempotencyKey, `${KEY_PREFIX}:%`)));
  await removeReservations(sampleReservations.map((row) => row.id));

  const sampleGuests = await db
    .select({ id: guests.id })
    .from(guests)
    .where(and(eq(guests.organizationId, organization.id), like(guests.email, `${GUEST_EMAIL_PREFIX}%@example.com`)));
  const guestIds = sampleGuests.map((row) => row.id);
  // Keep any sample guest someone has since booked for real.
  const stillBooked = guestIds.length
    ? new Set(
        (await db.select({ guestId: reservations.guestId }).from(reservations).where(inArray(reservations.guestId, guestIds))).map(
          (row) => row.guestId,
        ),
      )
    : new Set<string>();
  const removable = guestIds.filter((id) => !stillBooked.has(id));
  if (removable.length) {
    await db.transaction(async (tx) => {
      await tx.delete(auditEvents).where(inArray(auditEvents.entityId, removable));
      await tx.delete(guests).where(inArray(guests.id, removable));
    });
  }
  console.log(`Removed ${sampleReservations.length} sample reservation(s) and ${removable.length} sample guest(s) from "${organization.name}".`);
}

async function main() {
  const { name, dryRun, clean: cleaning } = args();
  if (!name) {
    console.error('Usage: npm run seed:reservations -- "<organization name>" [--dry-run] [--clean] [--allow-remote]');
    process.exit(1);
  }
  if (!dryRun) assertSafeDatabase();
  const organization = await findOrganization(name);
  console.log(`Organization: ${organization.name}`);
  if (cleaning) await clean(organization);
  else await seed(organization, dryRun);
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
