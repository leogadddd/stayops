import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditEvents, guests, reservations } from "@/lib/db/schema";
import { confirmHold, createGuest, createHold, deleteGuest, getReservationDetail, listGuestDirectory, ReservationError, updateGuest, updateReservation } from "@/server/reservations/service";
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

describe("the guest directory", () => {
  it("rolls up stays, nights and booked value, counting only kept bookings", async () => {
    const { org, owner, hold } = await setup();
    const walkIn = await createGuest({ organizationId: org.id, actorUserId: owner.id, data: { name: "Walk In", phone: "0917 000 1111" } });
    const [before, other] = await listGuestDirectory(org.id, { includeSpend: true });
    expect(before).toMatchObject({ id: hold.guestId, reservationCount: 1, stayCount: 0, nights: 0, spentCents: 0, activity: "upcoming" });
    expect(other).toMatchObject({ id: walkIn.id, reservationCount: 0, activity: "no_stays" });

    await confirmHold({ organizationId: org.id, actorUserId: owner.id, reservationId: hold.id, reason: "Paid in cash" });
    const [ana] = await listGuestDirectory(org.id, { includeSpend: true, sort: "stays" });
    expect(ana).toMatchObject({ id: hold.guestId, stayCount: 1, nights: 2, spentCents: 500_000 });
    expect(await listGuestDirectory(org.id, { show: "missing_email" })).toEqual([expect.objectContaining({ id: walkIn.id })]);
    expect(await listGuestDirectory(org.id, { query: "ana@" })).toEqual([expect.objectContaining({ id: hold.guestId })]);
  });

  it("edits a guest profile and records only the fields that changed", async () => {
    const { org, owner, hold } = await setup();
    await updateGuest({ organizationId: org.id, actorUserId: owner.id, guestId: hold.guestId, data: { name: "Ana Santos", email: "ana@example.com", notes: "Late arrival" } });
    const [event] = await db.select().from(auditEvents).where(and(eq(auditEvents.entityId, hold.guestId), eq(auditEvents.action, "guest.updated")));
    expect(event?.metadata).toEqual({ fields: ["notes"] });
    await expect(updateGuest({ organizationId: org.id, actorUserId: owner.id, guestId: hold.guestId, data: { name: "Ana Santos" } })).rejects.toThrow();
  });

  it("deletes only guests who never booked", async () => {
    const { org, owner, hold } = await setup();
    await expect(deleteGuest({ organizationId: org.id, actorUserId: owner.id, guestId: hold.guestId })).rejects.toBeInstanceOf(ReservationError);
    const walkIn = await createGuest({ organizationId: org.id, actorUserId: owner.id, data: { name: "Walk In", email: "walk@example.com" } });
    await deleteGuest({ organizationId: org.id, actorUserId: owner.id, guestId: walkIn.id });
    expect((await listGuestDirectory(org.id)).map((guest) => guest.id)).toEqual([hold.guestId]);
    const other = await createTestOrg("guests-other");
    await expect(deleteGuest({ organizationId: other.org.id, actorUserId: other.owner.id, guestId: hold.guestId })).rejects.toBeInstanceOf(ReservationError);
  });
});

describe("guest profiles", () => {
  it("saves optional details, clears blanks, and drops the flag reason once unflagged", async () => {
    const { org, owner } = await setup();
    const guest = await createGuest({
      organizationId: org.id, actorUserId: owner.id,
      data: { name: "Cara Lim", phone: "0917 333 4444", idType: "passport", idNumber: "P1234567", birthDate: "1990-05-01", tags: ["VIP", "corporate"], flagged: true, flagReason: "Late checkout twice" },
    });
    expect(guest).toMatchObject({ idType: "passport", idNumber: "P1234567", birthDate: "1990-05-01", tags: ["VIP", "corporate"], flagged: true, flagReason: "Late checkout twice", marketingOptIn: false, company: null });
    const updated = await updateGuest({ organizationId: org.id, actorUserId: owner.id, guestId: guest.id, data: { name: "Cara Lim", phone: "0917 333 4444", flagReason: "ignored while unflagged", tags: ["VIP"] } });
    expect(updated).toMatchObject({ idType: null, idNumber: null, birthDate: null, tags: ["VIP"], flagged: false, flagReason: null });
    const [event] = await db.select().from(auditEvents).where(and(eq(auditEvents.entityId, guest.id), eq(auditEvents.action, "guest.updated")));
    expect(event?.metadata).toEqual({ fields: ["birthDate", "idType", "idNumber", "tags", "flagged", "flagReason"] });
  });

  it("rejects an ID number without its type and a birth date in the future", async () => {
    const { org, owner } = await setup();
    const base = { name: "Dan Cruz", email: "dan@example.com" };
    await expect(createGuest({ organizationId: org.id, actorUserId: owner.id, data: { ...base, idNumber: "X1" } })).rejects.toThrow("ID type");
    await expect(createGuest({ organizationId: org.id, actorUserId: owner.id, data: { ...base, birthDate: "2999-01-01" } })).rejects.toThrow("future");
  });
});
