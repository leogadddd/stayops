import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { getGuestOrThrow, ReservationError } from "@/server/reservations/service";
import { PageHeading } from "@/components/app/page-heading";
import { PermissionDenied } from "@/components/app/permission-denied";
import { GuestForm } from "../../guest-form";

export const metadata: Metadata = { title: "Edit guest" };

export default async function EditGuestPage({ params }: { params: Promise<{ guestId: string }> }) {
  const membership = await requirePermission("guests.update");
  if (!membership) return <PermissionDenied />;

  const { guestId } = await params;
  let guest;
  try {
    guest = await getGuestOrThrow(membership.organizationId, guestId);
  } catch (error) {
    if (error instanceof ReservationError) notFound();
    throw error;
  }

  return (
    <div className="min-w-0 overflow-hidden">
      <PageHeading title="Edit guest" description={`${guest.name} · Changes show on all of this guest's reservations.`} backHref={`/guests/${guest.id}`} backLabel={guest.name} />
      <GuestForm guestId={guest.id} initialValues={{
          name: guest.name,
          email: guest.email ?? "",
          phone: guest.phone ?? "",
          notes: guest.notes ?? "",
          preferredName: guest.preferredName ?? "",
          birthDate: guest.birthDate ?? "",
          nationality: guest.nationality ?? "",
          idType: guest.idType ?? "",
          idNumber: guest.idNumber ?? "",
          address: guest.address ?? "",
          company: guest.company ?? "",
          tin: guest.tin ?? "",
          emergencyContactName: guest.emergencyContactName ?? "",
          emergencyContactPhone: guest.emergencyContactPhone ?? "",
          tags: guest.tags,
          flagged: guest.flagged,
          flagReason: guest.flagReason ?? "",
          marketingOptIn: guest.marketingOptIn,
        }} />
    </div>
  );
}
