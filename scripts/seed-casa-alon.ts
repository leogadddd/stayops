import "dotenv/config";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations, user } from "@/lib/db/schema";
import {
  createProperty,
  createUnit,
  listProperties,
  listPropertyUnits,
} from "@/server/inventory/service";
import { discardInventoryPhoto, storeInventoryPhoto } from "@/server/inventory/photos";

/**
 * Imports the Casa Alon sample property into the local development workspace.
 * It is idempotent, so rerunning it only adds records that are missing.
 *
 *   npm run seed:casa-alon
 */
const SOURCE_DIRECTORY = "/home/leogadil/Pictures/casa-alon-facebook";
const DEVELOPMENT_ORGANIZATION_SLUG = "stayops-development";
const OWNER_EMAIL = "dev-owner@stayops.dev";
const PROPERTY_NAME = "Casa Alon Beach Villas";

const PROPERTY = {
  name: PROPERTY_NAME,
  address: "Corong-Corong, El Nido, Palawan, Philippines",
  timezone: "Asia/Manila",
  checkInTime: "15:00",
  checkOutTime: "11:00",
  turnoverDurationMinutes: 120,
  houseRules:
    "No smoking indoors. Please observe quiet hours after 10 PM. Check out by 11 AM.",
  photo: "fb-hero.png",
};

const UNITS = [
  {
    name: "Seaview Suite",
    capacity: 2,
    bedrooms: 1,
    bathrooms: 1,
    defaultNightlyRateCents: 650_000,
    photo: "fb-seaview.png",
  },
  {
    name: "Garden Villa",
    capacity: 4,
    bedrooms: 2,
    bathrooms: 2,
    defaultNightlyRateCents: 950_000,
    photo: "fb-garden.png",
  },
  {
    name: "Poolside Loft",
    capacity: 6,
    bedrooms: 3,
    bathrooms: 2,
    defaultNightlyRateCents: 1_250_000,
    photo: "fb-loft.png",
  },
] as const;

async function uploadPhoto(organizationId: string, filename: string) {
  const body = new Uint8Array(await readFile(join(SOURCE_DIRECTORY, filename)));
  return storeInventoryPhoto(organizationId, { body, contentType: "image/png" });
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The Casa Alon sample import cannot run in production.");
  }

  const [organization] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, DEVELOPMENT_ORGANIZATION_SLUG))
    .limit(1);
  if (!organization) {
    throw new Error("Development workspace not found. Run npm run seed:development first.");
  }

  const [owner] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, OWNER_EMAIL))
    .limit(1);
  if (!owner) {
    throw new Error("Development owner not found. Run npm run seed:development first.");
  }

  const existingProperties = await listProperties(organization.id);
  let property = existingProperties.find((item) => item.name === PROPERTY_NAME);
  if (!property) {
    const imageUrl = await uploadPhoto(organization.id, PROPERTY.photo);
    try {
      property = await createProperty({
        organizationId: organization.id,
        actorUserId: owner.id,
        data: { ...PROPERTY, imageUrl },
      });
    } catch (error) {
      await discardInventoryPhoto(organization.id, imageUrl);
      throw error;
    }
    console.log(`Created property: ${property.name}`);
  } else {
    console.log(`Property already exists: ${property.name}`);
  }

  const existingUnits = await listPropertyUnits(organization.id, property.id);
  for (const unit of UNITS) {
    if (existingUnits.some((item) => item.name === unit.name)) {
      console.log(`Unit already exists: ${unit.name}`);
      continue;
    }

    const imageUrl = await uploadPhoto(organization.id, unit.photo);
    try {
      await createUnit({
        organizationId: organization.id,
        actorUserId: owner.id,
        propertyId: property.id,
        data: {
          ...unit,
          imageUrl,
          dayRates: {},
          cleaningFeeCents: null,
          securityDepositCents: null,
          checkInTime: PROPERTY.checkInTime,
          checkOutTime: PROPERTY.checkOutTime,
          status: "active",
        },
      });
    } catch (error) {
      await discardInventoryPhoto(organization.id, imageUrl);
      throw error;
    }
    console.log(`Created unit: ${unit.name}`);
  }
}

void main()
  .catch((error) => {
    console.error(
      "Casa Alon import failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(() => {
    setTimeout(() => process.exit(process.exitCode ?? 0), 250);
  });
