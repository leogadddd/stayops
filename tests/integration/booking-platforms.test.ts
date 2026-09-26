import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookingPlatforms, reservations } from "@/lib/db/schema";
import { DEFAULT_PLATFORMS } from "@/lib/platforms";
import { createHold, getReservationDetail, listReservations, ReservationError, updateReservation } from "@/server/reservations/service";
import { listPlatforms, seedDefaultPlatforms } from "@/server/reservations/platforms";
import { createActiveUnit, createTestOrg, createTestProperty, stayDates } from "./helpers";

const CHARGES = [{ type: "accommodation" as const, description: "Nightly rate", quantity: 2, unitAmountCents: 250_000 }];

async function setup(label: string) {
  const { org, owner } = await createTestOrg(label);
  const property = await createTestProperty(org.id, owner.id);
  const unit = await createActiveUnit(org.id, owner.id, property.id);
  const { checkIn, checkOut } = stayDates(40);
  const platforms = await listPlatforms(org.id);
  const byName = (name: string) => platforms.find((platform) => platform.name === name)!;
  return { org, owner, unit, checkIn, checkOut, byName };
}

describe("booking platforms", () => {
  it("gives every new organization the default platforms in order, once", async () => {
    const { org } = await createTestOrg("platform-defaults");
    expect((await listPlatforms(org.id)).map((platform) => platform.name)).toEqual(DEFAULT_PLATFORMS.map((platform) => platform.name));
    expect(await seedDefaultPlatforms(db, org.id)).toBe(0);
  });

  it("records where a booking came from, and filters by it", async () => {
    const { org, owner, unit, checkIn, checkOut, byName } = await setup("platform-booking");
    const airbnb = byName("Airbnb");
    const hold = await createHold({
      organizationId: org.id, actorUserId: owner.id,
      guest: { newGuest: { name: "Ana Santos", email: "ana@example.com" } },
      data: { unitId: unit.id, checkIn, checkOut, guestCount: 1, holdMinutes: 30, charges: CHARGES, platformId: airbnb.id, platformReference: "HMABC123" },
    });
    expect(hold).toMatchObject({ platformId: airbnb.id, platformReference: "HMABC123" });
    expect((await getReservationDetail(org.id, hold.id)).platform?.name).toBe("Airbnb");
    expect(await listReservations(org.id, { platformId: airbnb.id })).toEqual([expect.objectContaining({ id: hold.id, platformName: "Airbnb" })]);
    expect(await listReservations(org.id, { platformId: byName("Agoda").id })).toEqual([]);

    // An edit that doesn't mention the platform keeps it; a blank code clears the code.
    const base = { unitId: unit.id, checkIn, checkOut, guestCount: 1, charges: CHARGES, guestId: hold.guestId };
    await updateReservation({ organizationId: org.id, actorUserId: owner.id, reservationId: hold.id, data: { ...base, platformReference: "" } });
    const [row] = await db.select().from(reservations).where(eq(reservations.id, hold.id));
    expect(row).toMatchObject({ platformId: airbnb.id, platformReference: null });
  });

  it("rejects another organization's platform and retired platforms on new bookings", async () => {
    const { org, owner, unit, checkIn, checkOut, byName } = await setup("platform-reject");
    const other = await createTestOrg("platform-other");
    const [foreign] = await listPlatforms(other.org.id);
    const data = { unitId: unit.id, checkIn, checkOut, guestCount: 1, holdMinutes: 30, charges: CHARGES };
    const guest = { newGuest: { name: "Ben Reyes", phone: "0917 000 2222" } };
    await expect(createHold({ organizationId: org.id, actorUserId: owner.id, guest, data: { ...data, platformId: foreign!.id } })).rejects.toBeInstanceOf(ReservationError);
    const agoda = byName("Agoda");
    await db.update(bookingPlatforms).set({ isActive: false }).where(and(eq(bookingPlatforms.id, agoda.id)));
    await expect(createHold({ organizationId: org.id, actorUserId: owner.id, guest, data: { ...data, platformId: agoda.id } })).rejects.toBeInstanceOf(ReservationError);
  });
});
