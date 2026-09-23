import type { Metadata } from "next";
import { requireMembership } from "@/lib/auth/session";
import { addDaysLocal, todayInTimeZone } from "@/lib/dates";
import {
  listOrgUnits,
  listProperties,
} from "@/server/inventory/service";
import { listGuests } from "@/server/reservations/service";
import { ReservationForm } from "./reservation-form";

export const metadata: Metadata = { title: "New reservation" };

export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string; checkIn?: string; checkOut?: string }>;
}) {
  const membership = await requireMembership();
  const params = await searchParams;

  const [units, properties, guestRows] = await Promise.all([
    listOrgUnits(membership.organizationId),
    listProperties(membership.organizationId),
    listGuests(membership.organizationId),
  ]);

  const timezone = properties[0]?.timezone ?? "Asia/Manila";
  const today = todayInTimeZone(timezone);

  const unitLabel = (unit: (typeof units)[number]) => {
    const property = properties.find((item) => item.id === unit.propertyId);
    return properties.length > 1 && property
      ? `${property.name} · ${unit.name}`
      : unit.name;
  };

  const activeUnits = units.filter((unit) => unit.status === "active");

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl text-pine">New reservation</h1>
      <p className="mt-1 text-sm text-ink/60">
        {membership.role === "owner"
          ? "Place a time-limited hold or a confirmed booking."
          : "Place a time-limited hold for the owner to review."}{" "}
        Dates use each property&apos;s local timezone; the check-out day is free.
      </p>

      <ReservationForm
        isOwner={membership.role === "owner"}
        units={activeUnits.map((unit) => ({
          id: unit.id,
          label: unitLabel(unit),
          capacity: unit.capacity,
          nightlyRateCents: membership.role === "owner" ? unit.defaultNightlyRateCents : null,
          cleaningFeeCents: membership.role === "owner" ? unit.cleaningFeeCents : null,
          securityDepositCents: membership.role === "owner" ? unit.securityDepositCents : null,
        }))}
        guests={guestRows.map((guest) => ({ id: guest.id, name: guest.name }))}
        defaultCheckIn={params.checkIn ?? today}
        defaultCheckOut={params.checkOut ?? addDaysLocal(today, 1)}
        requestedUnitId={params.unit}
      />
    </div>
  );
}
