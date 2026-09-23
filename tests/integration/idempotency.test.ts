import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { paymentEntries, reservations } from "@/lib/db/schema";
import { createHold } from "@/server/reservations/service";
import { recordPayment } from "@/server/payments/service";
import {
  createActiveUnit,
  createTestOrg,
  createTestProperty,
  stayDates,
} from "./helpers";

const CHARGES = [
  {
    type: "accommodation" as const,
    description: "Nightly rate",
    quantity: 2,
    unitAmountCents: 250_000,
  },
];

describe("idempotent retries", () => {
  it("returns the same reservation when a hold create is retried with the same key", async () => {
    const { org, owner } = await createTestOrg("idem");
    const property = await createTestProperty(org.id, owner.id);
    const unit = await createActiveUnit(org.id, owner.id, property.id);
    const { checkIn, checkOut } = stayDates(60);

    const args = {
      organizationId: org.id,
      actorUserId: owner.id,
      guest: { newGuest: { name: "Retry Guest", email: "retry@example.com" } },
      idempotencyKey: "hold-retry-1",
      data: { unitId: unit.id, checkIn, checkOut, guestCount: 2, holdMinutes: 30, charges: CHARGES },
    };
    const first = await createHold(args);
    const second = await createHold(args);

    expect(second.id).toBe(first.id);
    const rows = await db
      .select({ id: reservations.id })
      .from(reservations)
      .where(eq(reservations.unitId, unit.id));
    expect(rows).toHaveLength(1);

    const next = stayDates(65);
    const concurrentArgs = {
      ...args,
      idempotencyKey: "hold-concurrent-1",
      data: { ...args.data, checkIn: next.checkIn, checkOut: next.checkOut },
    };
    const [a, b] = await Promise.all([
      createHold(concurrentArgs),
      createHold(concurrentArgs),
    ]);
    expect(a.id).toBe(b.id);
  });

  it("records a payment only once for repeated and concurrent same-key submits", async () => {
    const { org, owner } = await createTestOrg("idem-pay");
    const property = await createTestProperty(org.id, owner.id);
    const unit = await createActiveUnit(org.id, owner.id, property.id);
    const { checkIn, checkOut } = stayDates(61);

    const reservation = await createHold({
      organizationId: org.id,
      actorUserId: owner.id,
      guest: { newGuest: { name: "Pay Guest", email: "pay@example.com" } },
      idempotencyKey: "hold-pay-1",
      data: { unitId: unit.id, checkIn, checkOut, guestCount: 1, holdMinutes: 30, charges: CHARGES },
    });

    const pay = () =>
      recordPayment({
        organizationId: org.id,
        actorUserId: owner.id,
        reservationId: reservation.id,
        data: {
          amountPesos: "1000.00",
          allocation: "booking",
          method: "gcash",
          idempotencyKey: "pay-retry-1",
        },
      });

    const sequential = await pay();
    expect(sequential.alreadyRecorded).toBe(false);
    const retry = await pay();
    expect(retry.alreadyRecorded).toBe(true);
    expect(retry.entry.id).toBe(sequential.entry.id);

    // Two in-flight submits with the same key still collapse to one row.
    await db
      .delete(paymentEntries)
      .where(eq(paymentEntries.id, sequential.entry.id));
    const [concurrentA, concurrentB] = await Promise.all([pay(), pay()]);
    expect(concurrentA.entry.id).toBe(concurrentB.entry.id);
    expect(concurrentA.alreadyRecorded || concurrentB.alreadyRecorded).toBe(true);

    const rows = await db
      .select({ id: paymentEntries.id })
      .from(paymentEntries)
      .where(eq(paymentEntries.reservationId, reservation.id));
    expect(rows).toHaveLength(1);
  });
});
