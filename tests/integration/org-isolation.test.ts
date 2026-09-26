import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { auditEvents, memberships } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import {
  createHold,
  getReservationDetail,
  listReservations,
  ReservationError,
} from "@/server/reservations/service";
import { getUnitOrThrow } from "@/server/inventory/service";
import { InventoryError } from "@/server/inventory/validation";
import { recordPayment } from "@/server/payments/service";
import { PaymentError } from "@/server/payments/validation";
import { listAuditEvents } from "@/server/audit/service";
import { acceptInvitation, inviteStaff, removeStaff, OrgError } from "@/server/orgs/service";
import {
  createActiveUnit,
  createTestOrg,
  createTestProperty,
  createTestUser,
  stayDates,
} from "./helpers";

describe("organization isolation", () => {
  it("keeps another organization's records invisible across services", async () => {
    const a = await createTestOrg("iso-a");
    const b = await createTestOrg("iso-b");
    const propertyA = await createTestProperty(a.org.id, a.owner.id, "Property A");
    const propertyB = await createTestProperty(b.org.id, b.owner.id, "Property B");
    const unitA = await createActiveUnit(a.org.id, a.owner.id, propertyA.id, "Unit A");
    const unitB = await createActiveUnit(b.org.id, b.owner.id, propertyB.id, "Unit B");
    const { checkIn, checkOut } = stayDates(50);

    const reservationB = await createHold({
      organizationId: b.org.id,
      actorUserId: b.owner.id,
      guest: { newGuest: { name: "Guest B", email: "b@example.com" } },
      idempotencyKey: "iso-res-b",
      data: { unitId: unitB.id, checkIn, checkOut, guestCount: 1, holdMinutes: 30, charges: [
        { type: "accommodation", description: "Nightly rate", quantity: 2, unitAmountCents: 100_000 },
      ] },
    });

    // Reads scoped to org A never surface org B's records.
    await expect(
      getReservationDetail(a.org.id, reservationB.id),
    ).rejects.toBeInstanceOf(ReservationError);
    await expect(getUnitOrThrow(a.org.id, unitB.id)).rejects.toBeInstanceOf(
      InventoryError,
    );
    const listA = await listReservations(a.org.id);
    expect(listA.map((r) => r.id)).not.toContain(reservationB.id);

    // Mutations against another org's reservation are refused.
    await expect(
      recordPayment({
        organizationId: a.org.id,
        actorUserId: a.owner.id,
        reservationId: reservationB.id,
        data: {
          amountPesos: "1000",
          allocation: "booking",
          method: "bank_transfer",
          idempotencyKey: "iso-pay-a",
        },
      }),
    ).rejects.toBeInstanceOf(PaymentError);

    // Audit events stay scoped too.
    const activityA = await listAuditEvents(a.org.id, 100);
    expect(activityA.map((e) => e.action)).not.toContain("reservation.created");
    const activityB = await listAuditEvents(b.org.id, 100);
    expect(activityB.map((e) => e.action)).toContain("reservation.created");
    const orgBEvents = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.organizationId, b.org.id));
    expect(orgBEvents.length).toBeGreaterThan(0);

    // Sanity: org A can still read its own unit.
    const ownUnit = await getUnitOrThrow(a.org.id, unitA.id);
    expect(ownUnit.id).toBe(unitA.id);
  });

  it("adds registered staff, rejects duplicate and cross-org changes, and audits removal", async () => {
    const a = await createTestOrg("staff-a");
    const b = await createTestOrg("staff-b");
    const staff = await createTestUser("staff");
    const invite = { organizationId: a.org.id, actorUserId: a.owner.id, email: staff.email };
    const invitation = await inviteStaff(invite);
    expect(invitation.role).toBe("staff");
    await acceptInvitation({ code: invitation.code, userId: staff.id, email: staff.email });
    const [member] = await db.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.organizationId, a.org.id), eq(memberships.userId, staff.id)));
    expect(member).toBeTruthy();
    await expect(inviteStaff(invite)).rejects.toBeInstanceOf(OrgError);
    await expect(removeStaff({
      organizationId: b.org.id, actorUserId: b.owner.id, membershipId: member!.id,
    })).rejects.toBeInstanceOf(OrgError);
    await removeStaff({
      organizationId: a.org.id, actorUserId: a.owner.id, membershipId: member!.id,
    });
    const events = await listAuditEvents(a.org.id);
    expect(events.map((event) => event.action)).toContain("organization.staff_invited");
    expect(events.map((event) => event.action)).toContain("organization.staff_removed");
    await expect(removeStaff({
      organizationId: a.org.id, actorUserId: a.owner.id, membershipId: member!.id,
    })).rejects.toBeInstanceOf(OrgError);
  });
});
