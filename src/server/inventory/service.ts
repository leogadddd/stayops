import "server-only";

import { and, asc, eq, gt, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditEvents, properties, unitBlocks, units } from "@/lib/db/schema";
import {
  InventoryError,
  propertyInputSchema,
  unitBlockInputSchema,
  unitInputSchema,
  type PropertyInput,
  type UnitBlockInput,
  type UnitInput,
} from "./validation";

async function recordAudit(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], input: {
  organizationId: string;
  actorUserId: string;
  entity: string;
  entityId: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  await tx.insert(auditEvents).values({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    entity: input.entity,
    entityId: input.entityId,
    action: input.action,
    metadata: input.metadata,
  });
}

export async function listProperties(organizationId: string) {
  return db
    .select()
    .from(properties)
    .where(eq(properties.organizationId, organizationId))
    .orderBy(asc(properties.name));
}

export async function listOrgUnits(organizationId: string) {
  return db
    .select()
    .from(units)
    .where(eq(units.organizationId, organizationId))
    .orderBy(asc(units.name));
}

export async function getPropertyOrThrow(
  organizationId: string,
  propertyId: string,
) {
  const [property] = await db
    .select()
    .from(properties)
    .where(
      and(
        eq(properties.id, propertyId),
        eq(properties.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!property) {
    throw new InventoryError("Property not found.", "propertyId");
  }
  return property;
}

export async function listPropertyUnits(
  organizationId: string,
  propertyId: string,
) {
  return db
    .select()
    .from(units)
    .where(
      and(
        eq(units.organizationId, organizationId),
        eq(units.propertyId, propertyId),
      ),
    )
    .orderBy(asc(units.name));
}

export async function createProperty(input: {
  organizationId: string;
  actorUserId: string;
  data: PropertyInput;
}) {
  const data = propertyInputSchema.parse(input.data);
  return db.transaction(async (tx) => {
    const [property] = await tx
      .insert(properties)
      .values({
        organizationId: input.organizationId,
        name: data.name,
        address: data.address || null,
        timezone: data.timezone,
        checkInTime: data.checkInTime,
        checkOutTime: data.checkOutTime,
        houseRules: data.houseRules || null,
      })
      .returning();
    if (!property) {
      throw new InventoryError("Failed to create the property.");
    }
    await recordAudit(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "property",
      entityId: property.id,
      action: "property.created",
      metadata: { name: property.name },
    });
    return property;
  });
}

export async function updateProperty(input: {
  organizationId: string;
  actorUserId: string;
  propertyId: string;
  data: PropertyInput;
}) {
  const data = propertyInputSchema.parse(input.data);
  await getPropertyOrThrow(input.organizationId, input.propertyId);
  await db.transaction(async (tx) => {
    await tx
      .update(properties)
      .set({
        name: data.name,
        address: data.address || null,
        timezone: data.timezone,
        checkInTime: data.checkInTime,
        checkOutTime: data.checkOutTime,
        houseRules: data.houseRules || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(properties.id, input.propertyId),
          eq(properties.organizationId, input.organizationId),
        ),
      );
    await recordAudit(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "property",
      entityId: input.propertyId,
      action: "property.updated",
    });
  });
}

export async function createUnit(input: {
  organizationId: string;
  actorUserId: string;
  propertyId: string;
  data: UnitInput;
}) {
  const data = unitInputSchema.parse(input.data);
  await getPropertyOrThrow(input.organizationId, input.propertyId);
  return db.transaction(async (tx) => {
    const [unit] = await tx
      .insert(units)
      .values({
        organizationId: input.organizationId,
        propertyId: input.propertyId,
        ...data,
      })
      .returning();
    if (!unit) {
      throw new InventoryError("Failed to create the unit.");
    }
    await recordAudit(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "unit",
      entityId: unit.id,
      action: "unit.created",
      metadata: { name: unit.name, status: unit.status },
    });
    return unit;
  });
}

export async function getUnitOrThrow(organizationId: string, unitId: string) {
  const [unit] = await db
    .select()
    .from(units)
    .where(
      and(eq(units.id, unitId), eq(units.organizationId, organizationId)),
    )
    .limit(1);
  if (!unit) {
    throw new InventoryError("Unit not found.", "unitId");
  }
  return unit;
}

export async function updateUnit(input: {
  organizationId: string;
  actorUserId: string;
  unitId: string;
  data: UnitInput;
}) {
  const data = unitInputSchema.parse(input.data);
  const existing = await getUnitOrThrow(input.organizationId, input.unitId);
  await db.transaction(async (tx) => {
    await tx
      .update(units)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(units.id, input.unitId),
          eq(units.organizationId, input.organizationId),
        ),
      );
    if (existing.status !== data.status) {
      await recordAudit(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        entity: "unit",
        entityId: input.unitId,
        action: "unit.status_changed",
        metadata: { from: existing.status, to: data.status },
      });
    }
    await recordAudit(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "unit",
      entityId: input.unitId,
      action: "unit.updated",
    });
  });
}

export async function listUnitBlocks(
  organizationId: string,
  unitId: string,
  fromDate: string,
) {
  return db
    .select()
    .from(unitBlocks)
    .where(
      and(
        eq(unitBlocks.unitId, unitId),
        eq(unitBlocks.organizationId, organizationId),
        gt(unitBlocks.endDate, fromDate),
      ),
    )
    .orderBy(asc(unitBlocks.startDate));
}

export async function addUnitBlock(input: {
  organizationId: string;
  actorUserId: string;
  unitId: string;
  data: UnitBlockInput;
}) {
  const data = unitBlockInputSchema.parse(input.data);
  await getUnitOrThrow(input.organizationId, input.unitId);

  const overlapping = await db
    .select({ id: unitBlocks.id, reason: unitBlocks.reason })
    .from(unitBlocks)
    .where(
      and(
        eq(unitBlocks.unitId, input.unitId),
        eq(unitBlocks.organizationId, input.organizationId),
        lt(unitBlocks.startDate, data.endDate),
        gt(unitBlocks.endDate, data.startDate),
      ),
    )
    .limit(1);
  if (overlapping.length > 0) {
    throw new InventoryError(
      "Those dates overlap an existing out-of-service block on this unit.",
      "startDate",
    );
  }

  return db.transaction(async (tx) => {
    const [block] = await tx
      .insert(unitBlocks)
      .values({
        organizationId: input.organizationId,
        unitId: input.unitId,
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason,
        createdBy: input.actorUserId,
      })
      .returning();
    if (!block) {
      throw new InventoryError("Failed to create the block.");
    }
    await recordAudit(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "unit_block",
      entityId: block.id,
      action: "unit_block.created",
      metadata: {
        unitId: input.unitId,
        startDate: block.startDate,
        endDate: block.endDate,
        reason: block.reason,
      },
    });
    return block;
  });
}

export async function removeUnitBlock(input: {
  organizationId: string;
  actorUserId: string;
  blockId: string;
}) {
  await db.transaction(async (tx) => {
    const [removed] = await tx
      .delete(unitBlocks)
      .where(
        and(
          eq(unitBlocks.id, input.blockId),
          eq(unitBlocks.organizationId, input.organizationId),
        ),
      )
      .returning({ id: unitBlocks.id });
    if (!removed) {
      throw new InventoryError("Block not found.", "blockId");
    }
    await recordAudit(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "unit_block",
      entityId: input.blockId,
      action: "unit_block.removed",
    });
  });
}
