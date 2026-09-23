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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeading } from "@/components/app/page-heading";
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
      <PageHeading title="Reservations" description="Holds and bookings across your units.">
        <Link href="/reservations/new" className={buttonClassName("clay", "md")}>
          <Plus className="h-4 w-4" aria-hidden />
          New reservation
        </Link>
      </PageHeading>

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
              className={buttonClassName("clay", "md")}
            >
              New reservation
            </Link>
          }
        />
      ) : (
        <Card className="mt-6 overflow-hidden">
          <Table aria-label="Reservations">
            <TableHeader>
              <TableRow>
                <TableHead>Guest</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservations.map((reservation) => (
                <TableRow key={reservation.id}>
                  <TableCell>
                    <Link href={`/reservations/${reservation.id}`} className="font-medium text-pine underline-offset-4 hover:underline">
                      {reservation.guestName}
                    </Link>
                    <p className="mt-1 text-xs text-ink/55">{reservation.guestCount} {reservation.guestCount === 1 ? "guest" : "guests"}</p>
                  </TableCell>
                  <TableCell className="text-ink/70">{reservation.unitName}</TableCell>
                  <TableCell className="whitespace-nowrap text-ink/65">
                    {DATE_LABEL.format(new Date(`${reservation.checkInDate}T00:00:00Z`))} → {DATE_LABEL.format(new Date(`${reservation.checkOutDate}T00:00:00Z`))}
                  </TableCell>
                  <TableCell><Badge tone={STATUS_TONE[reservation.status] ?? "neutral"}>{RESERVATION_STATUS_LABELS[reservation.status]}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Link href={`/reservations/${reservation.id}`} aria-label={`View reservation for ${reservation.guestName}`} className={buttonClassName("outline", "sm")}>View</Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
