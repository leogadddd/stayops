import "server-only";

import { and, asc, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditEvents, properties, reservations, unitBlocks, units } from "@/lib/db/schema";
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
    .where(and(eq(properties.organizationId, organizationId), isNull(properties.deletedAt)))
    .orderBy(asc(properties.name));
}

export async function listOrgUnits(organizationId: string) {
  return db
    .select()
    .from(units)
    .where(and(eq(units.organizationId, organizationId), isNull(units.deletedAt)))
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
        isNull(properties.deletedAt),
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
        isNull(units.deletedAt),
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
        turnoverDurationMinutes: data.turnoverDurationMinutes,
        houseRules: data.houseRules || null,
        imageUrl: data.imageUrl || null,
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
      metadata: { name: property.name, turnoverDurationMinutes: property.turnoverDurationMinutes },
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
        turnoverDurationMinutes: data.turnoverDurationMinutes,
        houseRules: data.houseRules || null,
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl || null } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(properties.id, input.propertyId),
          eq(properties.organizationId, input.organizationId),
          isNull(properties.deletedAt),
        ),
      );
    await recordAudit(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "property",
      entityId: input.propertyId,
      action: "property.updated",
      metadata: { name: data.name, turnoverDurationMinutes: data.turnoverDurationMinutes },
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
  return db.transaction(async (tx) => {
    const [property] = await tx
      .select({ id: properties.id })
      .from(properties)
      .where(and(
        eq(properties.id, input.propertyId),
        eq(properties.organizationId, input.organizationId),
        isNull(properties.deletedAt),
      ))
      .limit(1)
      .for("key share");
    if (!property) {
      throw new InventoryError("Property not found.", "propertyId");
    }
    const [unit] = await tx
      .insert(units)
      .values({
        organizationId: input.organizationId,
        propertyId: input.propertyId,
        ...data,
        imageUrl: data.imageUrl || null,
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
      and(
        eq(units.id, unitId),
        eq(units.organizationId, organizationId),
        isNull(units.deletedAt),
      ),
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
          isNull(units.deletedAt),
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
      metadata: { name: data.name },
    });
  });
}

function activeReservationCondition(organizationId: string, unitIds: string[]) {
  return and(
    eq(reservations.organizationId, organizationId),
    inArray(reservations.unitId, unitIds),
    or(
      inArray(reservations.status, ["confirmed", "checked_in"]),
      and(eq(reservations.status, "hold"), gt(reservations.expiresAt, new Date())),
    ),
  );
}

export async function deleteUnit(input: {
  organizationId: string;
  actorUserId: string;
  unitId: string;
}) {
  await db.transaction(async (tx) => {
    const [unit] = await tx
      .select({ id: units.id, name: units.name, propertyId: units.propertyId })
      .from(units)
      .where(and(
        eq(units.id, input.unitId),
        eq(units.organizationId, input.organizationId),
        isNull(units.deletedAt),
      ))
      .limit(1)
      .for("update");
    if (!unit) throw new InventoryError("Unit not found.", "unitId");

    const [activeReservation] = await tx
      .select({ id: reservations.id })
      .from(reservations)
      .where(activeReservationCondition(input.organizationId, [unit.id]))
      .limit(1);
    if (activeReservation) {
      throw new InventoryError(
        "This unit has an active hold or stay. Cancel or complete it before deleting the unit.",
        "unitId",
      );
    }

    const deletedAt = new Date();
    await tx
      .update(units)
      .set({ deletedAt, status: "inactive", updatedAt: deletedAt })
      .where(and(eq(units.id, unit.id), eq(units.organizationId, input.organizationId)));
    await recordAudit(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "unit",
      entityId: unit.id,
      action: "unit.deleted",
      metadata: { name: unit.name, propertyId: unit.propertyId },
    });
  });
}

export async function deleteProperty(input: {
  organizationId: string;
  actorUserId: string;
  propertyId: string;
}) {
  await db.transaction(async (tx) => {
    const [property] = await tx
      .select({ id: properties.id, name: properties.name })
      .from(properties)
      .where(and(
        eq(properties.id, input.propertyId),
        eq(properties.organizationId, input.organizationId),
        isNull(properties.deletedAt),
      ))
      .limit(1)
      .for("update");
    if (!property) throw new InventoryError("Property not found.", "propertyId");

    const propertyUnits = await tx
      .select({ id: units.id, name: units.name })
      .from(units)
      .where(and(
        eq(units.organizationId, input.organizationId),
        eq(units.propertyId, property.id),
        isNull(units.deletedAt),
      ))
      .for("update");
    const unitIds = propertyUnits.map((unit) => unit.id);
    if (unitIds.length > 0) {
      const [activeReservation] = await tx
        .select({ id: reservations.id })
        .from(reservations)
        .where(activeReservationCondition(input.organizationId, unitIds))
        .limit(1);
      if (activeReservation) {
        throw new InventoryError(
          "This property has an active hold or stay. Cancel or complete it before deleting the property.",
          "propertyId",
        );
      }
    }

    const deletedAt = new Date();
    if (unitIds.length > 0) {
      await tx
        .update(units)
        .set({ deletedAt, status: "inactive", updatedAt: deletedAt })
        .where(and(
          eq(units.organizationId, input.organizationId),
          inArray(units.id, unitIds),
        ));
    }
    await tx
      .update(properties)
      .set({ deletedAt, updatedAt: deletedAt })
      .where(and(
        eq(properties.id, property.id),
        eq(properties.organizationId, input.organizationId),
      ));
    await recordAudit(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "property",
      entityId: property.id,
      action: "property.deleted",
      metadata: {
        name: property.name,
        deletedUnitCount: unitIds.length,
        deletedUnitNames: propertyUnits.map((unit) => unit.name),
      },
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
      .returning({
        id: unitBlocks.id,
        unitId: unitBlocks.unitId,
        startDate: unitBlocks.startDate,
        endDate: unitBlocks.endDate,
        reason: unitBlocks.reason,
      });
    if (!removed) {
      throw new InventoryError("Block not found.", "blockId");
    }
    await recordAudit(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "unit_block",
      entityId: input.blockId,
      action: "unit_block.removed",
      metadata: {
        unitId: removed.unitId,
        startDate: removed.startDate,
        endDate: removed.endDate,
        reason: removed.reason,
      },
    });
  });
}
