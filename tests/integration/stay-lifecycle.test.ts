import { describe, expect, it } from "vitest";
import { createHold, confirmHold } from "@/server/reservations/service";
import { recordPayment, getReservationLedger } from "@/server/payments/service";
import {
  checkIn,
  checkOut,
  getTaskDetail,
  markTaskReady,
  setTaskItemCompleted,
  updateChecklistTemplate,
  updateTaskNotes,
} from "@/server/operations/service";
import { listAuditEvents } from "@/server/audit/service";
import { getReport } from "@/server/reports/service";
import { createProperty } from "@/server/inventory/service";
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
  {
    type: "security_deposit" as const,
    description: "Refundable security deposit",
    quantity: 1,
    unitAmountCents: 100_000,
  },
];

describe("stay lifecycle (hold → payment → confirm → stay → turnover)", () => {
  it("runs the full acceptance scenario end to end", async () => {
    const { org, owner } = await createTestOrg("e2e");
    const property = await createTestProperty(org.id, owner.id);
    const unit = await createActiveUnit(org.id, owner.id, property.id);
    const { checkIn: inDate, checkOut: outDate } = stayDates(70);

    await updateChecklistTemplate({
      organizationId: org.id,
      actorUserId: owner.id,
      unitId: unit.id,
      data: [
        { label: "Strip and remake beds", required: true },
        { label: "Restock toiletries", required: true },
      ],
    });

    const hold = await createHold({
      organizationId: org.id,
      actorUserId: owner.id,
      guest: {
        newGuest: { name: "E2E Guest", email: "e2e@example.com", phone: "0917 000 0000" },
      },
      idempotencyKey: "e2e-hold-1",
      data: { unitId: unit.id, checkIn: inDate, checkOut: outDate, guestCount: 2, holdMinutes: 30, charges: CHARGES },
    });
    expect(hold.status).toBe("hold");

    const payment = await recordPayment({
      organizationId: org.id,
      actorUserId: owner.id,
      reservationId: hold.id,
      data: {
        amountPesos: "2500",
        allocation: "booking",
        method: "gcash",
        reference: "GCASH-1234",
        receivedAt: `${inDate}T15:00`,
        idempotencyKey: "e2e-pay-1",
      },
    });
    expect(payment.alreadyRecorded).toBe(false);

    const confirmed = await confirmHold({
      organizationId: org.id,
      actorUserId: owner.id,
      reservationId: hold.id,
      reason: "Guest sent the deposit",
    });
    expect(confirmed.status).toBe("confirmed");

    await checkIn({
      organizationId: org.id,
      actorUserId: owner.id,
      reservationId: hold.id,
      data: { note: "Walked the guest through the house rules." },
    });

    const { reservation: checkedOut, task } = await checkOut({
      organizationId: org.id,
      actorUserId: owner.id,
      reservationId: hold.id,
      data: {},
    });
    expect(checkedOut.status).toBe("checked_out");
    expect(task.status).toBe("open");

    const detail = await getTaskDetail(org.id, task.id);
    expect(detail.items).toHaveLength(2);
    expect(detail.assessment.canMarkReady).toBe(false);

    await updateTaskNotes({
      organizationId: org.id,
      actorUserId: owner.id,
      taskId: task.id,
      data: { notes: "Leave the spare key with the guard." },
    });

    for (const item of detail.items) {
      await setTaskItemCompleted({
        organizationId: org.id,
        actorUserId: owner.id,
        taskId: task.id,
        itemId: item.id,
        completed: true,
      });
    }

    const ready = await markTaskReady({
      organizationId: org.id,
      actorUserId: owner.id,
      actorRole: "owner",
      taskId: task.id,
      data: {},
    });
    expect(ready.status).toBe("ready");
    const notesEvent = (await listAuditEvents(org.id, 100))
      .find((event) => event.action === "task.notes_updated");
    expect(notesEvent?.entityId).toBe(task.id);
    expect(notesEvent?.metadata).toMatchObject({ hasNotes: true, characterCount: 35 });

    // Money ledger: partial booking payment collected, deposit untouched.
    const ledger = await getReservationLedger(org.id, hold.id);
    expect(ledger.balances.paidBookingCents).toBe(250_000);
    expect(ledger.balances.bookingBalanceCents).toBe(250_000);
    expect(ledger.balances.depositTotalCents).toBe(100_000);
    expect(ledger.balances.depositHeldCents).toBe(0);
    expect(ledger.payments).toHaveLength(1);

    // Report sees the two occupied nights and the booked accommodation value.
    const report = await getReport(org.id, { from: inDate, to: outDate });
    expect(report.summary.occupiedNights).toBe(2);
    expect(report.summary.bookableNights).toBe(2);
    expect(report.summary.accommodationBookedCents).toBe(500_000);
    expect(report.summary.bookingCollectedCents).toBe(250_000);
    expect(report.summary.netOperatingCashCents).toBe(250_000);
  });

  it("keeps cash period boundaries consistent across property filters", async () => {
    const { org, owner } = await createTestOrg("report-timezone");
    await createTestProperty(org.id, owner.id);
    const sydney = await createProperty({
      organizationId: org.id, actorUserId: owner.id,
      data: { name: "Test Sydney", timezone: "Australia/Sydney", checkInTime: "15:00", checkOutTime: "11:00" },
    });
    const unit = await createActiveUnit(org.id, owner.id, sydney.id);
    const { checkIn, checkOut } = stayDates(80);
    const hold = await createHold({
      organizationId: org.id, actorUserId: owner.id,
      guest: { newGuest: { name: "Timezone Test Guest", email: "timezone@example.com" } },
      data: { unitId: unit.id, checkIn, checkOut, guestCount: 1, holdMinutes: 30, charges: CHARGES },
    });
    await recordPayment({
      organizationId: org.id, actorUserId: owner.id, reservationId: hold.id,
      data: { amountPesos: "100", allocation: "booking", method: "cash", receivedAt: `${checkIn}T00:30` },
    });
    const all = await getReport(org.id, { from: checkIn, to: checkOut });
    const filtered = await getReport(org.id, { from: checkIn, to: checkOut, propertyId: sydney.id });
    expect(all.timezone).toBe("Asia/Manila");
    expect(filtered.timezone).toBe(all.timezone);
    expect(all.summary.bookingCollectedCents).toBe(0);
    expect(filtered.summary.bookingCollectedCents).toBe(all.summary.bookingCollectedCents);
  });
});
