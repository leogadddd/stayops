import "dotenv/config";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { expenses, memberships, organizations, tasks, user } from "@/lib/db/schema";
import { addDaysLocal } from "@/lib/dates";
import { createOrganization } from "@/server/orgs/service";
import {
  createDamageReport,
  checkIn,
  checkOut,
} from "@/server/operations/service";
import {
  addUnitBlock,
  createProperty,
  createUnit,
  listProperties,
  listPropertyUnits,
  listUnitBlocks,
} from "@/server/inventory/service";
import { eq } from "drizzle-orm";
import {
  createConfirmed,
  createHold,
  listReservations,
} from "@/server/reservations/service";
import { createGuestLink } from "@/server/reservations/guest-link";
import { recordPayment } from "@/server/payments/service";
import { createExpense } from "@/server/expenses/service";

/**
 * Seed clearly-fake demo data. Idempotent: safe to run repeatedly.
 *
 *   email:    owner@stayops.dev
 *   password: stayops-demo-1234
 */

const SEED_USER = {
  name: "Juan Dela Cruz",
  email: "owner@stayops.dev",
  password: "stayops-demo-1234",
};

const SEED_ORG_NAME = "Demo Stay Operations";

async function resolveSeedUserId(): Promise<string> {
  try {
    const signUp = await auth.api.signUpEmail({
      body: {
        name: SEED_USER.name,
        email: SEED_USER.email,
        password: SEED_USER.password,
      },
    });
    const userId = signUp.user?.id;
    if (!userId) {
      throw new Error("Seed sign-up failed and did not return a user.");
    }
    return userId;
  } catch (error) {
    const alreadyExists =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      (error as { statusCode?: number }).statusCode === 422;
    if (!alreadyExists) throw error;
  }

  const existingUser = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, SEED_USER.email))
    .limit(1);
  const existingId = existingUser[0]?.id;
  if (!existingId) {
    throw new Error("Demo user exists in auth but was not found in the user table.");
  }
  console.log(`seed: user already registered (${SEED_USER.email})`);
  return existingId;
}

async function main() {
  const userId = await resolveSeedUserId();
  console.log(`seed: user ready (${SEED_USER.email})`);

  let organizationId: string;
  const existing = await db
    .select({ organizationId: memberships.organizationId })
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    organizationId = existing[0]!.organizationId;
    console.log("seed: organization already exists, reusing it");
  } else {
    const org = await createOrganization({
      name: SEED_ORG_NAME,
      ownerUserId: userId,
    });
    organizationId = org.id;
    console.log(`seed: organization ready (${SEED_ORG_NAME})`);
  }

  const existingProperties = await listProperties(organizationId);
  if (existingProperties.length > 0) {
    console.log("seed: inventory already exists, nothing more to do");
  } else {
    const property = await createProperty({
      organizationId,
      actorUserId: userId,
      data: {
        name: "Riverside Demo Residences",
        address: "123 Demo Street, Sample Barangay, Manila (fake address)",
        timezone: "Asia/Manila",
        checkInTime: "15:00",
        checkOutTime: "11:00",
        houseRules:
          "Sample house rules for the demo: no smoking indoors, quiet hours after 10pm, check out by 11am.",
      },
    });

    await createUnit({
      organizationId,
      actorUserId: userId,
      propertyId: property.id,
      data: {
        name: "Unit 12B — Studio",
        capacity: 2,
        bedrooms: 0,
        bathrooms: 1,
        defaultNightlyRateCents: 5500 * 100,
        cleaningFeeCents: 500 * 100,
        securityDepositCents: 2000 * 100,
        checkInTime: "15:00", checkOutTime: "11:00",
        status: "active",
      },
    });

    await createUnit({
      organizationId,
      actorUserId: userId,
      propertyId: property.id,
      data: {
        name: "Unit 15A — One Bedroom",
        capacity: 3,
        bedrooms: 1,
        bathrooms: 1,
        defaultNightlyRateCents: 7200 * 100,
        cleaningFeeCents: 600 * 100,
        securityDepositCents: 3000 * 100,
        checkInTime: "15:00", checkOutTime: "11:00",
        status: "renovating",
      },
    });

    console.log("seed: property + units ready (Riverside Demo Residences)");
  }

  const seededProperty = (await listProperties(organizationId))[0];
  if (seededProperty) {
    const units = await listPropertyUnits(organizationId, seededProperty.id);
    const activeUnit = units.find((unit) => unit.status === "active");
    if (activeUnit) {
      const today = new Date().toISOString().slice(0, 10);
      const blocks = await listUnitBlocks(organizationId, activeUnit.id, today);
      if (blocks.length === 0) {
        await addUnitBlock({
          organizationId,
          actorUserId: userId,
          unitId: activeUnit.id,
          data: {
            startDate: addDaysLocal(today, 12),
            endDate: addDaysLocal(today, 14),
            reason: "Demo block — aircon servicing",
          },
        });
        console.log("seed: demo out-of-service block added");
      }
    }
  }

  const existingReservations = await listReservations(organizationId);
  if (existingReservations.length > 0) {
    console.log("seed: reservations already exist, nothing more to do");
  } else if (seededProperty) {
    const units = await listPropertyUnits(organizationId, seededProperty.id);
    const activeUnit = units.find((unit) => unit.status === "active");
    if (activeUnit) {
      const today = new Date().toISOString().slice(0, 10);
      const nightly = activeUnit.defaultNightlyRateCents;
      const cleaning = activeUnit.cleaningFeeCents ?? 0;
      const deposit = activeUnit.securityDepositCents ?? 0;

      // Clearly fake repeat guest shared by both demo stays.
      const hold = await createHold({
        organizationId,
        actorUserId: userId,
        guest: {
          newGuest: {
            name: "Maria Santos (demo)",
            email: "maria.santos.demo@example.com",
            notes: "Clearly fake seed guest.",
          },
        },
        idempotencyKey: "seed-hold-maria",
        data: {
          unitId: activeUnit.id,
          checkIn: addDaysLocal(today, 7),
          checkOut: addDaysLocal(today, 9),
          guestCount: 2,
          holdMinutes: 1440,
          charges: [
            {
              type: "accommodation",
              description: "Nightly rate",
              quantity: 2,
              unitAmountCents: nightly,
            },
            {
              type: "cleaning",
              description: "Cleaning fee",
              quantity: 1,
              unitAmountCents: cleaning,
            },
          ],
        },
      });
      console.log(
        `seed: demo hold ${hold.id} (${addDaysLocal(today, 7)} → ${addDaysLocal(today, 9)})`,
      );

      const confirmed = await createConfirmed({
        organizationId,
        actorUserId: userId,
        guest: { guestId: hold.guestId },
        idempotencyKey: "seed-confirmed-maria",
        data: {
          unitId: activeUnit.id,
          checkIn: addDaysLocal(today, 20),
          checkOut: addDaysLocal(today, 23),
          guestCount: 2,
          acknowledgeUnpaid: true,
          charges: [
            {
              type: "accommodation",
              description: "Nightly rate",
              quantity: 3,
              unitAmountCents: nightly,
            },
            {
              type: "cleaning",
              description: "Cleaning fee",
              quantity: 1,
              unitAmountCents: cleaning,
            },
            {
              type: "security_deposit",
              description: "Security deposit (refundable)",
              quantity: 1,
              unitAmountCents: deposit,
            },
          ],
        },
      });
      console.log(
        `seed: demo confirmed reservation ${confirmed.id} (${addDaysLocal(today, 20)} → ${addDaysLocal(today, 23)})`,
      );

      const link = await createGuestLink({
        organizationId,
        actorUserId: userId,
        reservationId: confirmed.id,
      });
      console.log(`seed: guest status link for the confirmed stay → /g/${link.token}`);
    }
  }

  // Demo money data. Idempotent so it also backfills databases seeded before
  // slice 3: payments carry fixed idempotency keys, expenses are matched by
  // their unique descriptions.
  const confirmedSeeds = existingReservations.filter(
    (reservation) => reservation.status === "confirmed",
  );
  if (seededProperty && confirmedSeeds.length > 0) {
    const reservation = confirmedSeeds[0]!;
    const paymentSeeds = [
      {
        idempotencyKey: "seed-payment-booking-1",
        amountPesos: "5000",
        allocation: "booking",
        method: "gcash",
        reference: "SEED-GCASH-REF-0001",
      },
      {
        idempotencyKey: "seed-payment-deposit-1",
        amountPesos: "2000",
        allocation: "security_deposit",
        method: "bank_transfer",
        reference: "SEED-BANK-REF-0002",
      },
    ] as const;
    for (const payment of paymentSeeds) {
      await recordPayment({
        organizationId,
        actorUserId: userId,
        reservationId: reservation.id,
        data: { ...payment },
      });
    }
    console.log(
      "seed: demo payments ensured (₱5,000 booking via GCash + ₱2,000 deposit via bank transfer)",
    );

    const today = new Date().toISOString().slice(0, 10);
    const expenseSeeds = [
      {
        propertyId: seededProperty.id,
        unitId: reservation.unitId,
        amountPesos: "850",
        category: "supplies",
        classification: "operating",
        paidDate: today,
        description: "Seeded demo expense: cleaning supplies restock (fake).",
      },
      {
        propertyId: seededProperty.id,
        amountPesos: "4500",
        category: "maintenance",
        classification: "capital",
        paidDate: today,
        description: "Seeded demo expense: hallway repainting, capital improvement (fake).",
      },
    ] as const;
    const existingDescriptions = new Set(
      (
        await db
          .select({ description: expenses.description })
          .from(expenses)
          .where(eq(expenses.organizationId, organizationId))
      ).map((row) => row.description),
    );
    for (const expense of expenseSeeds) {
      if (existingDescriptions.has(expense.description)) continue;
      await createExpense({
        organizationId,
        actorUserId: userId,
        data: { ...expense },
      });
    }
    console.log("seed: demo expenses ensured (one operating, one capital)");
  }

  // Demo stay operations. Idempotent: skipped once any turnover task exists,
  // so it also backfills databases seeded before slice 4.
  const existingTasks = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.organizationId, organizationId))
    .limit(1);
  if (existingTasks.length === 0 && seededProperty) {
    const units = await listPropertyUnits(organizationId, seededProperty.id);
    const activeUnit = units.find((unit) => unit.status === "active");
    if (activeUnit) {
      const today = new Date().toISOString().slice(0, 10);
      const nightly = activeUnit.defaultNightlyRateCents;
      const cleaning = activeUnit.cleaningFeeCents ?? 0;

      const pastStay = await createConfirmed({
        organizationId,
        actorUserId: userId,
        guest: {
          newGuest: {
            name: "Pedro Reyes (demo)",
            email: "pedro.reyes.demo@example.com",
            notes: "Clearly fake seed guest for the checked-out stay.",
          },
        },
        idempotencyKey: "seed-checkedout-pedro",
        data: {
          unitId: activeUnit.id,
          checkIn: addDaysLocal(today, -4),
          checkOut: addDaysLocal(today, -2),
          guestCount: 1,
          acknowledgeUnpaid: true,
          charges: [
            {
              type: "accommodation",
              description: "Nightly rate",
              quantity: 2,
              unitAmountCents: nightly,
            },
            {
              type: "cleaning",
              description: "Cleaning fee",
              quantity: 1,
              unitAmountCents: cleaning,
            },
          ],
        },
      });
      await checkIn({
        organizationId,
        actorUserId: userId,
        reservationId: pastStay.id,
        data: { note: "Demo check-in." },
      });
      const { task } = await checkOut({
        organizationId,
        actorUserId: userId,
        reservationId: pastStay.id,
        data: { note: "Demo check-out." },
      });
      await createDamageReport({
        organizationId,
        actorUserId: userId,
        unitId: activeUnit.id,
        reservationId: pastStay.id,
        data: {
          description: "Demo damage: stained bedsheet set (fake).",
          estimatedAmountPesos: "800",
        },
      });
      console.log(
        `seed: demo checked-out stay ${pastStay.id} → open turnover task ${task.id} + open damage report`,
      );
    }
  }

  const orgs = await db.select().from(organizations).limit(1);
  console.log("\nDemo credentials");
  console.log("  email:   ", SEED_USER.email);
  console.log("  password:", SEED_USER.password);
  console.log("  org:     ", orgs[0]?.name ?? SEED_ORG_NAME);
}

main()
  .catch((error) => {
    console.error("seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    // postgres.js keeps the connection pool open; let the process exit.
    setTimeout(() => process.exit(process.exitCode ?? 0), 250);
  });
