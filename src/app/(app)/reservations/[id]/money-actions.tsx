import type { ReactNode } from "react";
import { computeTotals } from "@/lib/charges";
import { getReservationLedger } from "@/server/payments/service";
import { listOpenDamageReports } from "@/server/operations/service";
import { loadActionReservation } from "./action-page";
import { AddDeductionForm } from "./add-deduction-form";
import { RecordPaymentForm } from "./record-payment-form";
import { RecordRefundForm } from "./record-refund-form";

/**
 * One money action (payment, refund, deduction) for a reservation: the same
 * rules render as a full page on direct visits and as a modal over the
 * reservation when opened from it. Call only after the owner guard.
 */
export interface MoneyActionPanel {
  title: string;
  description: string;
  unavailable?: string;
  form?: ReactNode;
}

type Detail = Awaited<ReturnType<typeof loadActionReservation>>;

function ended(detail: Detail) {
  return detail.reservation.status === "cancelled" || detail.reservation.status === "expired";
}

export async function paymentPanel(organizationId: string, id: string): Promise<MoneyActionPanel> {
  const detail = await loadActionReservation(organizationId, id);
  const { guest, unit, charges } = detail;
  const base = { title: "Record payment", description: `${guest.name} · ${unit.name}. Verify receipt in your account before recording.` };
  if (ended(detail)) return { ...base, unavailable: "Payments cannot be recorded from this reservation's current state." };
  const { balances } = await getReservationLedger(organizationId, id);
  return {
    ...base,
    form: (
      <RecordPaymentForm
        reservationId={id}
        depositRequired={computeTotals(charges).depositTotalCents > 0}
        timeZone={detail.property?.timezone ?? "Asia/Manila"}
        amounts={{
          bookingTotalCents: balances.bookingTotalCents,
          bookingPaidCents: balances.paidBookingCents - balances.refundedBookingCents,
          depositTotalCents: balances.depositTotalCents,
          depositPaidCents: balances.paidDepositCents - balances.refundedDepositCents,
        }}
      />
    ),
  };
}

export async function refundPanel(organizationId: string, id: string): Promise<MoneyActionPanel> {
  const detail = await loadActionReservation(organizationId, id);
  const { guest, unit } = detail;
  const base = { title: "Record refund", description: `${guest.name} · ${unit.name}. Record money already returned to the guest.` };
  if (ended(detail)) return { ...base, unavailable: "Refunds cannot be recorded from this reservation's current state." };
  const { balances } = await getReservationLedger(organizationId, id);
  const bookingRefundable = balances.paidBookingCents - balances.refundedBookingCents > 0;
  const depositRefundable = balances.depositHeldCents > 0;
  if (!bookingRefundable && !depositRefundable) return { ...base, unavailable: "Nothing to refund yet: no payment has been recorded for this reservation." };
  return {
    ...base,
    form: (
      <RecordRefundForm
        reservationId={id}
        canRefundBooking={bookingRefundable}
        canRefundDeposit={depositRefundable}
        amounts={{
          bookingRefundableCents: Math.max(0, balances.paidBookingCents - balances.refundedBookingCents),
          bookingPaidCents: balances.paidBookingCents,
          depositHeldCents: balances.depositHeldCents,
          depositPaidCents: balances.paidDepositCents,
        }}
      />
    ),
  };
}

export async function deductionPanel(organizationId: string, id: string): Promise<MoneyActionPanel> {
  const detail = await loadActionReservation(organizationId, id);
  const { guest, unit, charges } = detail;
  const base = { title: "Record deposit deduction", description: `${guest.name} · ${unit.name}. Explain the amount kept from the security deposit.` };
  if (ended(detail) || computeTotals(charges).depositTotalCents <= 0) return { ...base, unavailable: "A deposit deduction is not available for this reservation." };
  const { balances } = await getReservationLedger(organizationId, id);
  if (balances.depositHeldCents <= 0) return { ...base, unavailable: "No deposit has been collected yet, so there is nothing to deduct from." };
  const reports = await listOpenDamageReports(organizationId, unit.id);
  return { ...base, form: <AddDeductionForm reservationId={id} depositHeldCents={balances.depositHeldCents} damageReports={reports.map((report) => ({ id: report.id, description: report.description }))} /> };
}
