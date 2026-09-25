import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditEvents, guests, reservations } from "@/lib/db/schema";
import { createHold, getReservationDetail, ReservationError, updateReservation } from "@/server/reservations/service";
import { createActiveUnit, createTestOrg, createTestProperty, stayDates } from "./helpers";

const CHARGES = [{ type: "accommodation" as const, description: "Nightly rate", quantity: 2, unitAmountCents: 250_000 }];

async function setup() {
  const { org, owner } = await createTestOrg("guests");
  const property = await createTestProperty(org.id, owner.id);
  const unit = await createActiveUnit(org.id, owner.id, property.id);
  const { checkIn, checkOut } = stayDates(40);
  const hold = await createHold({
    organizationId: org.id,
    actorUserId: owner.id,
    guest: { newGuest: { name: "Ana Santos", email: "ana@example.com" } },
    data: { unitId: unit.id, checkIn, checkOut, guestCount: 1, holdMinutes: 30, charges: CHARGES },
  });
  const base = { unitId: unit.id, checkIn, checkOut, guestCount: 1, charges: CHARGES };
  return { org, owner, unit, hold, base };
}

describe("editing a reservation's guests", () => {
  it("updates the primary guest's profile and records what changed", async () => {
    const { org, owner, hold, base } = await setup();
    await updateReservation({
      organizationId: org.id, actorUserId: owner.id, reservationId: hold.id,
      data: { ...base, guestId: hold.guestId, primaryGuest: { name: "Ana Santos-Cruz", email: "ana@example.com", phone: "+63 917 000 0000" } },
    });
    const [guest] = await db.select().from(guests).where(eq(guests.id, hold.guestId));
    expect(guest).toMatchObject({ name: "Ana Santos-Cruz", email: "ana@example.com", phone: "+63 917 000 0000" });
    const [event] = await db.select().from(auditEvents).where(and(eq(auditEvents.entityId, hold.guestId), eq(auditEvents.action, "guest.updated")));
    expect(event?.metadata).toEqual({ fields: ["name", "phone"] });
  });

  it("creates a new primary guest and saves additional guests", async () => {
    const { org, owner, hold, base } = await setup();
    await updateReservation({
      organizationId: org.id, actorUserId: owner.id, reservationId: hold.id,
      data: { ...base, guestCount: 3, occupantNames: ["Ben Reyes", "Cara Lim"], primaryGuest: { name: "Dan Cruz", phone: "0917 111 2222" } },
    });
    const detail = await getReservationDetail(org.id, hold.id);
    expect(detail.guest).toMatchObject({ name: "Dan Cruz", phone: "0917 111 2222" });
    expect(detail.guest.id).not.toBe(hold.guestId);
    expect(detail.occupants.map((occupant) => occupant.name)).toEqual(["Ben Reyes", "Cara Lim"]);
  });

  it("rejects more guests than the unit sleeps", async () => {
    const { org, owner, hold, base } = await setup();
    await expect(updateReservation({
      organizationId: org.id, actorUserId: owner.id, reservationId: hold.id,
      data: { ...base, guestId: hold.guestId, guestCount: 5, occupantNames: ["A One", "B Two", "C Three", "D Four"] },
    })).rejects.toBeInstanceOf(ReservationError);
    const [row] = await db.select({ guestCount: reservations.guestCount }).from(reservations).where(eq(reservations.id, hold.id));
    expect(row?.guestCount).toBe(1);
  });
});
