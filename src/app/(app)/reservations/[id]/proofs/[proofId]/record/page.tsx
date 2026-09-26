import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { getReservationLedger } from "@/server/payments/service";
import { ReservationActionPage, loadActionReservation } from "../../../action-page";
import { RecordProofForm } from "../../../record-proof-form";

export const metadata: Metadata = { title: "Record payment from reference" };

export default async function RecordProofPage({ params }: { params: Promise<{ id: string; proofId: string }> }) {
  const membership = await requirePermission("payments.update");
  if (!membership) return <PermissionDenied />;
  const { id, proofId } = await params;
  const { reservation, guest, unit } = await loadActionReservation(membership.organizationId, id);
  const ledger = await getReservationLedger(membership.organizationId, id);
  const proof = ledger.proofs.find((item) => item.id === proofId && item.reservationId === id && item.organizationId === membership.organizationId);
  if (!proof) notFound();
  const available = proof.status === "unverified" && reservation.status !== "cancelled" && reservation.status !== "expired";
  return (
    <ReservationActionPage title="Record payment from reference" description={`${guest.name} · ${unit.name}. Review the guest's reference before recording a payment.`} reservationId={id}
      unavailable={available ? undefined : "This reference has already been reviewed or the reservation is no longer active."}>
      {available ? (
        <div className="space-y-5">
          <dl className="rounded-lg bg-paper p-4 text-sm">
            <dt className="text-xs font-medium uppercase tracking-wide text-ink/50">Guest-submitted reference</dt>
            <dd className="mt-1 break-words font-medium text-pine">{proof.reference}</dd>
            {proof.note ? <><dt className="mt-3 text-xs font-medium uppercase tracking-wide text-ink/50">Guest note</dt><dd className="mt-1 whitespace-pre-wrap text-ink/70">{proof.note}</dd></> : null}
          </dl>
          <RecordProofForm reservationId={id} proofId={proof.id} reference={proof.reference} />
        </div>
      ) : null}
    </ReservationActionPage>
  );
}
