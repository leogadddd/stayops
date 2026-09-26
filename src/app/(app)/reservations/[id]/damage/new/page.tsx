import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { DamageReportForm } from "@/app/(app)/tasks/damage-report-form";
import { ReservationActionPage, loadActionReservation } from "../../action-page";

export const metadata: Metadata = { title: "Report damage" };

export default async function NewReservationDamagePage({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requirePermission("damage.create");
  if (!membership) return <PermissionDenied />;
  const { id } = await params;
  const { reservation, guest, unit } = await loadActionReservation(membership.organizationId, id);
  const available = reservation.status === "checked_in" || reservation.status === "checked_out";
  return (
    <ReservationActionPage title="Report damage" description={`${guest.name} · ${unit.name}. Describe damage found during the stay or turnover.`} reservationId={id}
      unavailable={available ? undefined : "Damage can be reported here after the guest has checked in."}>
      {available ? <DamageReportForm unitId={unit.id} reservationId={id} returnHref={`/reservations/${id}`} /> : null}
    </ReservationActionPage>
  );
}
