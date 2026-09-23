import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/app/page-heading";
import { Card, CardBody } from "@/components/ui/card";
import { db } from "@/lib/db";
import { expireStaleHolds } from "@/server/reservations/holds";
import { getReservationDetail, ReservationError } from "@/server/reservations/service";

// Call only after the page's owner or membership guard has succeeded.
export async function loadActionReservation(organizationId: string, id: string) {
  await expireStaleHolds(db, organizationId);
  try {
    return await getReservationDetail(organizationId, id);
  } catch (error) {
    if (error instanceof ReservationError) notFound();
    throw error;
  }
}

export function ReservationActionPage({
  title,
  description,
  reservationId,
  unavailable,
  children,
}: {
  title: string;
  description: string;
  reservationId: string;
  unavailable?: string;
  children?: ReactNode;
}) {
  const href = `/reservations/${reservationId}`;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeading title={title} description={description} backHref={href} backLabel="Back to reservation" />
      <Card>
        <CardBody>
          {unavailable ? <p className="text-sm text-ink/65" role="status">{unavailable}</p> : children}
        </CardBody>
      </Card>
      <Link href={href} className="mt-5 inline-block text-sm font-medium text-pine underline-offset-4 hover:underline">
        Return to reservation
      </Link>
    </div>
  );
}
