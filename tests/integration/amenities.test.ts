import { describe, expect, it } from "vitest";
import { DEFAULT_PROPERTY_AMENITIES, DEFAULT_UNIT_AMENITIES } from "@/lib/amenities";
import { createProperty, createUnit, updateProperty, updateUnit } from "@/server/inventory/service";
import {
  createAmenity,
  listAmenities,
  listPropertyAmenities,
  listUnitAmenities,
  seedDefaultAmenities,
} from "@/server/inventory/amenities";
import { InventoryError } from "@/server/inventory/validation";
import { db } from "@/lib/db";
import { createActiveUnit, createTestOrg, createTestProperty } from "./helpers";

const PROPERTY_DATA = { name: "Amenity Towers", timezone: "Asia/Manila", checkInTime: "15:00", checkOutTime: "11:00" };

describe("amenities", () => {
  it("gives every new organization the default catalog, once", async () => {
    const { org } = await createTestOrg("amenity-defaults");
    const byName = (a: string, b: string) => a.toLowerCase().localeCompare(b.toLowerCase());
    expect((await listAmenities(org.id, "property")).map((amenity) => amenity.name)).toEqual(DEFAULT_PROPERTY_AMENITIES.map((amenity) => amenity.name).sort(byName));
    expect(await listAmenities(org.id, "unit")).toHaveLength(DEFAULT_UNIT_AMENITIES.length);
    expect(await seedDefaultAmenities(db, org.id)).toBe(0);
  });

  it("creates custom amenities and reuses an existing name regardless of case", async () => {
    const { org, owner } = await createTestOrg("amenity-custom");
    const sauna = await createAmenity({ organizationId: org.id, actorUserId: owner.id, scope: "property", name: "  Infinity   sauna " });
    expect(sauna.name).toBe("Infinity sauna");
    const again = await createAmenity({ organizationId: org.id, actorUserId: owner.id, scope: "property", name: "infinity SAUNA" });
    expect(again.id).toBe(sauna.id);
    // Same name in the other scope is a separate amenity.
    const unitSauna = await createAmenity({ organizationId: org.id, actorUserId: owner.id, scope: "unit", name: "Infinity sauna" });
    expect(unitSauna.id).not.toBe(sauna.id);
    await expect(createAmenity({ organizationId: org.id, actorUserId: owner.id, scope: "unit", name: "x" })).rejects.toBeInstanceOf(InventoryError);
  });

  it("saves and replaces property and unit amenities", async () => {
    const { org, owner } = await createTestOrg("amenity-links");
    const [pool, parking] = await listAmenities(org.id, "property");
    const [wifi, aircon] = await listAmenities(org.id, "unit");
    const property = await createProperty({ organizationId: org.id, actorUserId: owner.id, data: PROPERTY_DATA, amenityIds: [pool!.id, parking!.id] });
    expect((await listPropertyAmenities(org.id, property.id)).map((amenity) => amenity.id).sort()).toEqual([pool!.id, parking!.id].sort());
    await updateProperty({ organizationId: org.id, actorUserId: owner.id, propertyId: property.id, data: PROPERTY_DATA, amenityIds: [parking!.id] });
    expect((await listPropertyAmenities(org.id, property.id)).map((amenity) => amenity.id)).toEqual([parking!.id]);

    const unit = await createActiveUnit(org.id, owner.id, property.id);
    const unitData = { name: unit.name, capacity: 4, bedrooms: 2, bathrooms: 1, defaultNightlyRateCents: 250_000, cleaningFeeCents: null, securityDepositCents: null, checkInTime: "15:00", checkOutTime: "11:00", status: "active" as const };
    await updateUnit({ organizationId: org.id, actorUserId: owner.id, unitId: unit.id, data: unitData, amenityIds: [wifi!.id, aircon!.id, wifi!.id] });
    expect((await listUnitAmenities(org.id, unit.id)).map((amenity) => amenity.id).sort()).toEqual([wifi!.id, aircon!.id].sort());
    // Omitting amenityIds leaves the selection untouched.
    await updateUnit({ organizationId: org.id, actorUserId: owner.id, unitId: unit.id, data: unitData });
    expect(await listUnitAmenities(org.id, unit.id)).toHaveLength(2);
  });

  it("rejects amenities from the other scope or another organization", async () => {
    const { org, owner } = await createTestOrg("amenity-guard");
    const { org: other } = await createTestOrg("amenity-other");
    const property = await createTestProperty(org.id, owner.id);
    const [unitAmenity] = await listAmenities(org.id, "unit");
    const [foreignAmenity] = await listAmenities(other.id, "property");
    for (const amenityId of [unitAmenity!.id, foreignAmenity!.id]) {
      await expect(updateProperty({ organizationId: org.id, actorUserId: owner.id, propertyId: property.id, data: PROPERTY_DATA, amenityIds: [amenityId] })).rejects.toBeInstanceOf(InventoryError);
    }
    await expect(createUnit({
      organizationId: org.id, actorUserId: owner.id, propertyId: property.id, amenityIds: [foreignAmenity!.id],
      data: { name: "Guarded", capacity: 2, bedrooms: 1, bathrooms: 1, defaultNightlyRateCents: 100_000, cleaningFeeCents: null, securityDepositCents: null, checkInTime: "15:00", checkOutTime: "11:00", status: "active" },
    })).rejects.toBeInstanceOf(InventoryError);
    expect(await listPropertyAmenities(org.id, property.id)).toEqual([]);
  });
});
