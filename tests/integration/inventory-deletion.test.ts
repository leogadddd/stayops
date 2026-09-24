import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { properties, reservations, units } from "@/lib/db/schema";
import {
  deleteProperty,
  deleteUnit,
  getPropertyOrThrow,
  getUnitOrThrow,
  listOrgUnits,
  listProperties,
} from "@/server/inventory/service";
import { InventoryError } from "@/server/inventory/validation";
import { cancelReservation, createHold, getReservationDetail } from "@/server/reservations/service";
import { createActiveUnit, createTestOrg, createTestProperty, stayDates } from "./helpers";

describe("inventory soft deletion", () => {
  it("hides a deleted unit while retaining its database row", async () => {
    const { org, owner } = await createTestOrg("delete-unit");
    const property = await createTestProperty(org.id, owner.id);
    const unit = await createActiveUnit(org.id, owner.id, property.id);

    await deleteUnit({ organizationId: org.id, actorUserId: owner.id, unitId: unit.id });

    expect(await listOrgUnits(org.id)).toEqual([]);
    await expect(getUnitOrThrow(org.id, unit.id)).rejects.toBeInstanceOf(InventoryError);
    const [stored] = await db.select().from(units).where(and(eq(units.id, unit.id), eq(units.organizationId, org.id)));
    expect(stored?.deletedAt).toBeInstanceOf(Date);
    expect(stored?.status).toBe("inactive");
  });

  it("blocks deletion during a live hold, then preserves the cancelled reservation", async () => {
    const { org, owner } = await createTestOrg("delete-guard");
    const property = await createTestProperty(org.id, owner.id);
    const unit = await createActiveUnit(org.id, owner.id, property.id);
    const { checkIn, checkOut } = stayDates(20);
    const hold = await createHold({
      organizationId: org.id,
      actorUserId: owner.id,
      guest: { newGuest: { name: "Delete guard guest", email: "delete-guard@example.com" } },
      data: {
        unitId: unit.id,
        checkIn,
        checkOut,
        guestCount: 1,
        holdMinutes: 60,
        charges: [{ type: "accommodation", description: "Nightly rate", quantity: 2, unitAmountCents: 100_000 }],
      },
    });

    await expect(deleteUnit({ organizationId: org.id, actorUserId: owner.id, unitId: unit.id }))
      .rejects.toThrow("active hold or stay");
    await cancelReservation({
      organizationId: org.id,
      actorUserId: owner.id,
      reservationId: hold.id,
      reason: "Test cleanup",
    });
    await deleteUnit({ organizationId: org.id, actorUserId: owner.id, unitId: unit.id });

    const detail = await getReservationDetail(org.id, hold.id);
    expect(detail.reservation.status).toBe("cancelled");
    const [storedReservation] = await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.id, hold.id));
    expect(storedReservation?.id).toBe(hold.id);
  });

  it("blocks an occupied property, then soft deletes it and its units together", async () => {
    const { org, owner } = await createTestOrg("delete-property");
    const property = await createTestProperty(org.id, owner.id);
    const unit = await createActiveUnit(org.id, owner.id, property.id);
    const { checkIn, checkOut } = stayDates(30);
    const hold = await createHold({
      organizationId: org.id,
      actorUserId: owner.id,
      guest: { newGuest: { name: "Property guard guest", email: "property-guard@example.com" } },
      data: {
        unitId: unit.id,
        checkIn,
        checkOut,
        guestCount: 1,
        holdMinutes: 60,
        charges: [{ type: "accommodation", description: "Nightly rate", quantity: 2, unitAmountCents: 100_000 }],
      },
    });

    await expect(deleteProperty({ organizationId: org.id, actorUserId: owner.id, propertyId: property.id }))
      .rejects.toThrow("active hold or stay");
    await cancelReservation({
      organizationId: org.id,
      actorUserId: owner.id,
      reservationId: hold.id,
      reason: "Test cleanup",
    });
    await deleteProperty({ organizationId: org.id, actorUserId: owner.id, propertyId: property.id });

    expect(await listProperties(org.id)).toEqual([]);
    expect(await listOrgUnits(org.id)).toEqual([]);
    await expect(getPropertyOrThrow(org.id, property.id)).rejects.toBeInstanceOf(InventoryError);
    const [storedProperty] = await db.select().from(properties).where(eq(properties.id, property.id));
    const [storedUnit] = await db.select().from(units).where(eq(units.id, unit.id));
    expect(storedProperty?.deletedAt).toBeInstanceOf(Date);
    expect(storedUnit?.deletedAt).toBeInstanceOf(Date);
  });
});
