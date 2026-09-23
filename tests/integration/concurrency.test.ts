import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reservations } from "@/lib/db/schema";
import { createHold, ReservationError } from "@/server/reservations/service";
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

describe("concurrent hold creation", () => {
  it("allows exactly one of two overlapping holds for the same unit", async () => {
    const { org, owner } = await createTestOrg("race");
    const property = await createTestProperty(org.id, owner.id);
    const unit = await createActiveUnit(org.id, owner.id, property.id);
    const { checkIn, checkOut } = stayDates(40);

    const attempt = (key: string) =>
      createHold({
        organizationId: org.id,
        actorUserId: owner.id,
        guest: {
          newGuest: { name: "Race Guest", email: `${key}@example.com` },
        },
        idempotencyKey: key,
        data: { unitId: unit.id, checkIn, checkOut, guestCount: 2, holdMinutes: 30, charges: CHARGES },
      });

    const results = await Promise.allSettled([attempt("race-a"), attempt("race-b")]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter(
      (r) => r.status === "rejected" && r.reason instanceof ReservationError,
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const rows = await db
      .select({ id: reservations.id })
      .from(reservations)
      .where(eq(reservations.unitId, unit.id));
    expect(rows).toHaveLength(1);
  });
});
