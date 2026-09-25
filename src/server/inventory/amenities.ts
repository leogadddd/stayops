import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { amenities, auditEvents, propertyAmenities, unitAmenities, type AmenityScope } from "@/lib/db/schema";
import { DEFAULT_AMENITIES, normalizeAmenityName } from "@/lib/amenities";
import { InventoryError } from "./validation";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = Tx | typeof db;

export interface AmenityOption {
  id: string;
  name: string;
  icon: string | null;
}

/** Adds any missing default amenities to an organization's catalog. Idempotent. */
export async function seedDefaultAmenities(executor: Executor, organizationId: string): Promise<number> {
  const rows = (Object.entries(DEFAULT_AMENITIES) as [AmenityScope, (typeof DEFAULT_AMENITIES)[AmenityScope]][])
    .flatMap(([scope, defaults]) => defaults.map((amenity) => ({ organizationId, scope, name: amenity.name, icon: amenity.icon })));
  const inserted = await executor.insert(amenities).values(rows).onConflictDoNothing().returning({ id: amenities.id });
  return inserted.length;
}

export async function listAmenities(organizationId: string, scope: AmenityScope): Promise<AmenityOption[]> {
  return db
    .select({ id: amenities.id, name: amenities.name, icon: amenities.icon })
    .from(amenities)
    .where(and(eq(amenities.organizationId, organizationId), eq(amenities.scope, scope)))
    .orderBy(asc(sql`lower(${amenities.name})`));
}

/** Creates a custom amenity, or returns the existing one with the same name. */
export async function createAmenity(input: {
  organizationId: string;
  actorUserId: string;
  scope: AmenityScope;
  name: string;
}): Promise<AmenityOption> {
  const name = normalizeAmenityName(input.name);
  if (!name) throw new InventoryError("Amenity names need 2–60 characters.", "name");
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(amenities)
      .values({ organizationId: input.organizationId, scope: input.scope, name })
      .onConflictDoNothing()
      .returning({ id: amenities.id, name: amenities.name, icon: amenities.icon });
    if (created) {
      await tx.insert(auditEvents).values({
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        entity: "amenity",
        entityId: created.id,
        action: "amenity.created",
        metadata: { name, scope: input.scope },
      });
      return created;
    }
    const [existing] = await tx
      .select({ id: amenities.id, name: amenities.name, icon: amenities.icon })
      .from(amenities)
      .where(and(eq(amenities.organizationId, input.organizationId), eq(amenities.scope, input.scope), sql`lower(${amenities.name}) = lower(${name})`))
      .limit(1);
    if (!existing) throw new InventoryError("Failed to create the amenity.");
    return existing;
  });
}

/** Rejects amenity IDs from another organization or the other scope. */
async function assertAmenities(tx: Tx, organizationId: string, scope: AmenityScope, amenityIds: string[]) {
  if (amenityIds.length === 0) return;
  const found = await tx
    .select({ id: amenities.id })
    .from(amenities)
    .where(and(eq(amenities.organizationId, organizationId), eq(amenities.scope, scope), inArray(amenities.id, amenityIds)));
  if (found.length !== amenityIds.length) {
    throw new InventoryError("One of the selected amenities is no longer available. Refresh and try again.", "amenityIds");
  }
}

export async function replacePropertyAmenities(tx: Tx, organizationId: string, propertyId: string, amenityIds: string[]) {
  const ids = [...new Set(amenityIds)];
  await assertAmenities(tx, organizationId, "property", ids);
  await tx.delete(propertyAmenities).where(and(eq(propertyAmenities.organizationId, organizationId), eq(propertyAmenities.propertyId, propertyId)));
  if (ids.length) await tx.insert(propertyAmenities).values(ids.map((amenityId) => ({ organizationId, propertyId, amenityId })));
}

export async function replaceUnitAmenities(tx: Tx, organizationId: string, unitId: string, amenityIds: string[]) {
  const ids = [...new Set(amenityIds)];
  await assertAmenities(tx, organizationId, "unit", ids);
  await tx.delete(unitAmenities).where(and(eq(unitAmenities.organizationId, organizationId), eq(unitAmenities.unitId, unitId)));
  if (ids.length) await tx.insert(unitAmenities).values(ids.map((amenityId) => ({ organizationId, unitId, amenityId })));
}

export async function listPropertyAmenities(organizationId: string, propertyId: string): Promise<AmenityOption[]> {
  return db
    .select({ id: amenities.id, name: amenities.name, icon: amenities.icon })
    .from(propertyAmenities)
    .innerJoin(amenities, and(eq(propertyAmenities.amenityId, amenities.id), eq(propertyAmenities.organizationId, amenities.organizationId)))
    .where(and(eq(propertyAmenities.organizationId, organizationId), eq(propertyAmenities.propertyId, propertyId)))
    .orderBy(asc(sql`lower(${amenities.name})`));
}

export async function listUnitAmenities(organizationId: string, unitId: string): Promise<AmenityOption[]> {
  return db
    .select({ id: amenities.id, name: amenities.name, icon: amenities.icon })
    .from(unitAmenities)
    .innerJoin(amenities, and(eq(unitAmenities.amenityId, amenities.id), eq(unitAmenities.organizationId, amenities.organizationId)))
    .where(and(eq(unitAmenities.organizationId, organizationId), eq(unitAmenities.unitId, unitId)))
    .orderBy(asc(sql`lower(${amenities.name})`));
}
