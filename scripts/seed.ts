import "dotenv/config";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberships, organizations, user } from "@/lib/db/schema";
import { addDaysLocal } from "@/lib/dates";
import { createOrganization } from "@/server/orgs/service";
import {
  addUnitBlock,
  createProperty,
  createUnit,
  listProperties,
  listPropertyUnits,
  listUnitBlocks,
} from "@/server/inventory/service";
import { eq } from "drizzle-orm";

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
