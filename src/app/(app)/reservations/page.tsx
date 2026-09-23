import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requireMembership } from "@/lib/auth/session";
import { RESERVATION_STATUSES } from "@/lib/db/schema";
import { RESERVATION_STATUS_LABELS } from "@/lib/labels";
import { listReservations } from "@/server/reservations/service";
import { expireStaleHolds } from "@/server/reservations/holds";
import { listOrgUnits } from "@/server/inventory/service";
import { Button, buttonClassName } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Reservations" };

const DATE_LABEL = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const STATUS_TONE: Record<string, "sage" | "clay" | "neutral"> = {
  hold: "clay",
  confirmed: "sage",
  checked_in: "sage",
  checked_out: "neutral",
  cancelled: "neutral",
  expired: "neutral",
};

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    unit?: string;
  }>;
}) {
  const membership = await requireMembership();
  const params = await searchParams;
  await expireStaleHolds(db, membership.organizationId);

  const status = RESERVATION_STATUSES.includes(
    params.status as (typeof RESERVATION_STATUSES)[number],
  )
    ? (params.status as (typeof RESERVATION_STATUSES)[number])
    : undefined;

  const [reservations, units] = await Promise.all([
    listReservations(membership.organizationId, {
      query: params.q,
      status,
      unitId: params.unit,
    }),
    listOrgUnits(membership.organizationId),
  ]);

  const filterQuery = new URLSearchParams();
  if (params.q) filterQuery.set("q", params.q);
  if (status) filterQuery.set("status", status);
  if (params.unit) filterQuery.set("unit", params.unit);
  const filterString = filterQuery.toString();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-pine">Reservations</h1>
          <p className="mt-1 text-sm text-ink/60">
            Holds and bookings across your units.
          </p>
        </div>
        <Link
          href="/reservations/new"
          className={buttonClassName("primary", "md")}
        >
          <Plus className="h-4 w-4" aria-hidden />
          New reservation
        </Link>
      </div>

      <Card className="mt-6 px-4 py-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <label htmlFor="q" className="mb-1.5 block text-sm font-medium text-ink">
              Search guest
            </label>
            <Input
              id="q"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Name, email or phone"
            />
          </div>
          <div className="w-40">
            <label htmlFor="status" className="mb-1.5 block text-sm font-medium text-ink">
              Status
            </label>
            <Select id="status" name="status" defaultValue={status ?? ""}>
              <option value="">All statuses</option>
              {RESERVATION_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {RESERVATION_STATUS_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-48">
            <label htmlFor="unit" className="mb-1.5 block text-sm font-medium text-ink">
              Unit
            </label>
            <Select id="unit" name="unit" defaultValue={params.unit ?? ""}>
              <option value="">All units</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="outline" size="md">
            Filter
          </Button>
          {filterString ? (
            <Link
              href="/reservations"
              className="text-sm text-pine/70 underline-offset-4 hover:text-pine hover:underline"
            >
              Clear
            </Link>
          ) : null}
        </form>
      </Card>

      {reservations.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="No reservations found"
          description={
            filterString
              ? "Nothing matches these filters. Try widening the search."
              : "Create a hold or confirmed booking to get started."
          }
          action={
            <Link
              href="/reservations/new"
              className={buttonClassName("primary", "md")}
            >
              New reservation
            </Link>
          }
        />
      ) : (
        <Card className="mt-6 overflow-hidden">
          <ul className="divide-y divide-pine/10">
            {reservations.map((reservation) => (
              <li key={reservation.id}>
                <Link
                  href={`/reservations/${reservation.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-pine-mist/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-pine">
                      {reservation.guestName}
                      <span className="ml-2 font-normal text-ink/50">
                        {reservation.unitName}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-ink/55">
                      {DATE_LABEL.format(
                        new Date(`${reservation.checkInDate}T00:00:00Z`),
                      )}{" "}
                      →{" "}
                      {DATE_LABEL.format(
                        new Date(`${reservation.checkOutDate}T00:00:00Z`),
                      )}
                      {reservation.guestCount > 1
                        ? ` · ${reservation.guestCount} guests`
                        : " · 1 guest"}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[reservation.status] ?? "neutral"}>
                    {RESERVATION_STATUS_LABELS[reservation.status]}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
