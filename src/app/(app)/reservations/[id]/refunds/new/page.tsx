import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { ReservationActionPage, loadActionReservation } from "../../action-page";
import { RecordRefundForm } from "../../record-refund-form";

export const metadata: Metadata = { title: "Record refund" };

export default async function NewRefundPage({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requireOwner();
  if (!membership) return <PermissionDenied />;
  const { id } = await params;
  const { reservation, guest, unit } = await loadActionReservation(membership.organizationId, id);
  const available = reservation.status !== "cancelled" && reservation.status !== "expired";
  return (
    <ReservationActionPage title="Record refund" description={`${guest.name} · ${unit.name}. Record money already returned to the guest.`} reservationId={id}
      unavailable={available ? undefined : "Refunds cannot be recorded from this reservation's current state."}>
      {available ? <RecordRefundForm reservationId={id} /> : null}
    </ReservationActionPage>
  );
}
