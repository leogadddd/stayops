import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { getReservationFeeStatus, isLiveHold } from "@/server/reservations/service";
import { ReservationActionPage, loadActionReservation } from "../action-page";
import { ConfirmHoldForm } from "../confirm-hold-form";

export const metadata: Metadata = { title: "Confirm hold" };

export default async function ConfirmReservationPage({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requirePermission("reservations.update");
  if (!membership) return <PermissionDenied />;
  const { id } = await params;
  const { reservation, guest, unit } = await loadActionReservation(membership.organizationId, id);
  const available = isLiveHold(reservation.status, reservation.expiresAt);
  const fee = available ? await getReservationFeeStatus(membership.organizationId, id) : null;
  return (
    <ReservationActionPage title="Confirm hold" description={`${guest.name} · ${unit.name}. Confirm this stay and keep the dates reserved.`} reservationId={id}
      unavailable={available ? undefined : "Only an active, unexpired hold can be confirmed."}>
      {available ? <ConfirmHoldForm reservationId={id} fee={fee} /> : null}
    </ReservationActionPage>
  );
}
