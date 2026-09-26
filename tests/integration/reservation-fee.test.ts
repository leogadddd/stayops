import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reservations, units } from "@/lib/db/schema";
import { confirmHold, createConfirmed, createHold, getReservationFeeStatus, ReservationError, updateReservation } from "@/server/reservations/service";
import { recordPayment } from "@/server/payments/service";
import { listPlatforms } from "@/server/reservations/platforms";
import { createActiveUnit, createTestOrg, createTestProperty, stayDates } from "./helpers";

// Two nights at ₱2,500: a ₱5,000 booking total.
const CHARGES = [{ type: "accommodation" as const, description: "Nightly rate", quantity: 2, unitAmountCents: 250_000 }];

async function setup(label: string, fee: { type: "fixed" | "percent"; amount: number } | null) {
  const { org, owner } = await createTestOrg(label);
  const property = await createTestProperty(org.id, owner.id);
  const unit = await createActiveUnit(org.id, owner.id, property.id);
  if (fee) {
    await db.update(units).set({ reservationFeeType: fee.type, reservationFeeAmount: fee.amount }).where(eq(units.id, unit.id));
  }
  const platforms = await listPlatforms(org.id);
  const byName = (name: string) => platforms.find((platform) => platform.name === name)!;
  const { checkIn, checkOut } = stayDates(40);
  const base = { unitId: unit.id, checkIn, checkOut, guestCount: 1, charges: CHARGES };
  const args = { organizationId: org.id, actorUserId: owner.id, guest: { newGuest: { name: "Ana Santos", email: "ana@example.com" } } };
  return { org, owner, unit, byName, base, args };
}

describe("reservation fee", () => {
  it("marks OTAs as collecting payment and messaging channels as not", async () => {
    const { byName } = await setup("fee-platforms", null);
    expect(byName("Airbnb").collectsPayment).toBe(true);
    expect(byName("Agoda").collectsPayment).toBe(true);
    expect(byName("Direct").collectsPayment).toBe(false);
    expect(byName("Facebook").collectsPayment).toBe(false);
    expect(byName("Messenger").collectsPayment).toBe(false);
  });

  it("copies the unit's fee onto direct and Messenger bookings, not Airbnb ones", async () => {
    const { byName, base, args } = await setup("fee-copy", { type: "percent", amount: 3000 });
    const direct = await createHold({ ...args, data: { ...base, holdMinutes: 30, platformId: byName("Messenger").id } });
    expect(direct).toMatchObject({ reservationFeeType: "percent", reservationFeeAmount: 3000 });
    expect(await getReservationFeeStatus(args.organizationId, direct.id)).toEqual({ requiredCents: 150_000, outstandingCents: 150_000 });

    const { checkIn, checkOut } = stayDates(50);
    const airbnb = await createHold({ ...args, data: { ...base, checkIn, checkOut, holdMinutes: 30, platformId: byName("Airbnb").id } });
    expect(airbnb).toMatchObject({ reservationFeeType: null, reservationFeeAmount: null });
  });

  it("needs a reason to confirm a hold until the fee is paid", async () => {
    const { org, owner, byName, base, args } = await setup("fee-confirm", { type: "fixed", amount: 100_000 });
    const hold = await createHold({ ...args, data: { ...base, holdMinutes: 30, platformId: byName("Direct").id } });
    await expect(confirmHold({ organizationId: org.id, actorUserId: owner.id, reservationId: hold.id })).rejects.toThrow("₱1,000 left to pay");

    await recordPayment({ organizationId: org.id, actorUserId: owner.id, reservationId: hold.id, data: { amountPesos: "600", allocation: "booking", method: "gcash" } });
    await expect(confirmHold({ organizationId: org.id, actorUserId: owner.id, reservationId: hold.id })).rejects.toBeInstanceOf(ReservationError);

    await recordPayment({ organizationId: org.id, actorUserId: owner.id, reservationId: hold.id, data: { amountPesos: "400", allocation: "booking", method: "gcash" } });
    const confirmed = await confirmHold({ organizationId: org.id, actorUserId: owner.id, reservationId: hold.id });
    expect(confirmed).toMatchObject({ status: "confirmed", confirmReason: null });
  });

  it("still confirms an unpaid hold with a reason", async () => {
    const { org, owner, base, args } = await setup("fee-reason", { type: "fixed", amount: 100_000 });
    const hold = await createHold({ ...args, data: { ...base, holdMinutes: 30 } });
    const confirmed = await confirmHold({ organizationId: org.id, actorUserId: owner.id, reservationId: hold.id, reason: "Regular guest" });
    expect(confirmed).toMatchObject({ status: "confirmed", confirmReason: "Regular guest" });
  });

  it("won't book straight to confirmed with less than the fee, unless acknowledged", async () => {
    const { byName, base, args } = await setup("fee-create", { type: "percent", amount: 5000 });
    const payment = (amountPesos: string) => ({ amountPesos, allocation: "booking" as const, method: "cash" as const });
    await expect(createConfirmed({ ...args, data: { ...base, platformId: byName("Facebook").id, initialPayment: payment("1000") } })).rejects.toThrow("reservation fee of ₱2,500");

    const paid = await createConfirmed({ ...args, idempotencyKey: crypto.randomUUID(), data: { ...base, platformId: byName("Facebook").id, initialPayment: payment("2500") } });
    expect(paid.status).toBe("confirmed");

    const { checkIn, checkOut } = stayDates(60);
    const acknowledged = await createConfirmed({ ...args, data: { ...base, checkIn, checkOut, acknowledgeUnpaid: true } });
    expect(acknowledged.status).toBe("confirmed");

    const later = stayDates(70);
    const airbnb = await createConfirmed({ ...args, data: { ...base, ...later, platformId: byName("Airbnb").id, initialPayment: payment("100") } });
    expect(airbnb.reservationFeeType).toBeNull();
  });

  it("re-derives the fee when the platform changes, and keeps it otherwise", async () => {
    const { org, owner, unit, byName, base, args } = await setup("fee-update", { type: "fixed", amount: 100_000 });
    const hold = await createHold({ ...args, data: { ...base, holdMinutes: 30, platformId: byName("Airbnb").id } });
    const edit = { ...base, guestId: hold.guestId, occupantNames: [] };

    await updateReservation({ organizationId: org.id, actorUserId: owner.id, reservationId: hold.id, data: { ...edit, platformId: byName("Direct").id } });
    let [row] = await db.select().from(reservations).where(eq(reservations.id, hold.id));
    expect(row).toMatchObject({ reservationFeeType: "fixed", reservationFeeAmount: 100_000 });

    // A later change to the unit's fee doesn't reach existing bookings.
    await db.update(units).set({ reservationFeeType: "fixed", reservationFeeAmount: 200_000 }).where(eq(units.id, unit.id));
    await updateReservation({ organizationId: org.id, actorUserId: owner.id, reservationId: hold.id, data: { ...edit, platformId: byName("Direct").id } });
    [row] = await db.select().from(reservations).where(eq(reservations.id, hold.id));
    expect(row?.reservationFeeAmount).toBe(100_000);
  });
});
