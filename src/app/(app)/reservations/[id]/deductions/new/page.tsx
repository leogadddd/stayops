import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { computeTotals } from "@/lib/charges";
import { PermissionDenied } from "@/components/app/permission-denied";
import { listOpenDamageReports } from "@/server/operations/service";
import { ReservationActionPage, loadActionReservation } from "../../action-page";
import { AddDeductionForm } from "../../add-deduction-form";

export const metadata: Metadata = { title: "Record deposit deduction" };

export default async function NewDeductionPage({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requireOwner();
  if (!membership) return <PermissionDenied />;
  const { id } = await params;
  const { reservation, guest, unit, charges } = await loadActionReservation(membership.organizationId, id);
  const available = reservation.status !== "cancelled" && reservation.status !== "expired" && computeTotals(charges).depositTotalCents > 0;
  const reports = available ? await listOpenDamageReports(membership.organizationId, unit.id) : [];
  return (
    <ReservationActionPage title="Record deposit deduction" description={`${guest.name} · ${unit.name}. Explain the amount kept from the security deposit.`} reservationId={id}
      unavailable={available ? undefined : "A deposit deduction is not available for this reservation."}>
      {available ? <AddDeductionForm reservationId={id} damageReports={reports.map((report) => ({ id: report.id, description: report.description }))} /> : null}
    </ReservationActionPage>
  );
}
