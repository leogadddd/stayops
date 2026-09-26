import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Search, X } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { PermissionDenied } from "@/components/app/permission-denied";
import { RESERVATION_STATUSES, type ReservationStatus } from "@/lib/db/schema";
import { RESERVATION_STATUS_LABELS } from "@/lib/labels";
import { isLocalDate, nightsBetween } from "@/lib/dates";
import { formatPHP } from "@/lib/money";
import { cn } from "@/lib/utils";
import { listReservations } from "@/server/reservations/service";
import { expireStaleHolds } from "@/server/reservations/holds";
import { listOrgUnits } from "@/server/inventory/service";
import { listPlatforms } from "@/server/reservations/platforms";
import { PlatformBadge } from "@/components/app/platform-badge";
import { buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeading } from "@/components/app/page-heading";
import { RESERVATION_STATUS_STYLES, ReservationStatusBadge } from "@/components/app/reservation-status-badge";
import { db } from "@/lib/db";
import { TableActionsMenu } from "@/components/ui/table-actions-menu";
import { quickCancelReservationAction } from "./actions";
import { ReservationFilters } from "./reservation-filters";

export const metadata: Metadata = { title: "Reservations" };

const DATE_LABEL = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const DATE_WITH_YEAR = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
// Bookings are stamped in UTC; show when they were made in the operators' local time.
const YEAR = new Intl.DateTimeFormat("en-PH", { year: "numeric", timeZone: "Asia/Manila" });
const CREATED_AT = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });
const HOLD_EXPIRY = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });

/** "Tue, Oct 20" this year; "Oct 20, 2027" otherwise, so the column stays narrow. */
function dayLabel(date: string, thisYear: string) {
  const value = new Date(`${date}T00:00:00Z`);
  return date.startsWith(thisYear) ? DATE_LABEL.format(value) : DATE_WITH_YEAR.format(value);
}
export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    unit?: string;
    platform?: string;
    start?: string;
    end?: string;
    sort?: string;
  }>;
}) {
  const membership = await requirePermission("reservations.view");
  if (!membership) return <PermissionDenied />;
  const params = await searchParams;
  await expireStaleHolds(db, membership.organizationId);
  const showTotals = can(membership, "payments.view");
  const canEdit = can(membership, "reservations.update") && can(membership, "payments.create");
  const canCancel = can(membership, "reservations.delete");

  const status = RESERVATION_STATUSES.includes(params.status as ReservationStatus)
    ? (params.status as ReservationStatus)
    : undefined;
  const sort = params.sort === "booked" ? "booked" : "checkin";
  const startDate = isLocalDate(params.start ?? "") ? params.start : undefined;
  const endDate = isLocalDate(params.end ?? "") ? params.end : undefined;

  // Loaded without the status filter so the status pills can show counts.
  const [allReservations, units, platforms] = await Promise.all([
    listReservations(membership.organizationId, { query: params.q, unitId: params.unit, platformId: params.platform, startDate, endDate, sort, includeTotals: showTotals }),
    listOrgUnits(membership.organizationId),
    listPlatforms(membership.organizationId, { includeInactive: true }),
  ]);
  const reservations = status ? allReservations.filter((reservation) => reservation.status === status) : allReservations;
  const counts = new Map<ReservationStatus, number>();
  for (const reservation of allReservations) counts.set(reservation.status, (counts.get(reservation.status) ?? 0) + 1);
  const showProperty = new Set(units.map((unit) => unit.propertyId)).size > 1;
  const thisYear = YEAR.format(new Date());

  const hrefWith = (patch: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    const next = { q: params.q, status, unit: params.unit, platform: params.platform, start: startDate, end: endDate, sort: sort === "booked" ? "booked" : undefined, ...patch };
    for (const [key, value] of Object.entries(next)) if (value) query.set(key, value);
    const text = query.toString();
    return text ? `/reservations?${text}` : "/reservations";
  };
  const filtered = Boolean(params.q || status || params.unit || params.platform || startDate || endDate);

  return (
    <div className="min-w-0 overflow-hidden">
      <PageHeading title="Reservations" description="Holds and bookings across your units.">
        <Link href="/reservations/new" className={buttonClassName("clay", "md")}>
          <Plus className="h-4 w-4" aria-hidden />
          New reservation
        </Link>
      </PageHeading>

      <nav aria-label="Filter by status" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [mask-image:linear-gradient(to_right,#000_calc(100%-2.5rem),transparent)] pr-10 sm:pr-0 sm:[mask-image:none] sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
        <StatusPill href={hrefWith({ status: undefined })} active={!status} label="All" count={allReservations.length} />
        {RESERVATION_STATUSES.map((value) => (
          <StatusPill key={value} href={hrefWith({ status: value })} active={status === value} label={RESERVATION_STATUS_LABELS[value]} count={counts.get(value) ?? 0} dot={RESERVATION_STATUS_STYLES[value].dot} />
        ))}
      </nav>

      {/* Search and filters share one row, even on phones; filters stay at the right end. */}
      <div className="mt-4 flex items-center gap-2 sm:gap-3">
        <form method="get" role="search" className="min-w-0 flex-1 sm:max-w-md">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          {params.unit ? <input type="hidden" name="unit" value={params.unit} /> : null}
          {params.platform ? <input type="hidden" name="platform" value={params.platform} /> : null}
          {startDate ? <input type="hidden" name="start" value={startDate} /> : null}
          {endDate ? <input type="hidden" name="end" value={endDate} /> : null}
          {sort === "booked" ? <input type="hidden" name="sort" value="booked" /> : null}
          <label htmlFor="reservation-search" className="sr-only">Search guest</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pine/45" aria-hidden />
            {/* Enter searches; the clear link keeps every other filter. */}
            <Input id="reservation-search" type="search" name="q" defaultValue={params.q ?? ""} placeholder="Search guest name, email or phone" className="pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden" />
            {params.q ? (
              <Link href={hrefWith({ q: undefined })} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink/45 hover:bg-pine-mist hover:text-pine">
                <X className="h-4 w-4" aria-hidden />
              </Link>
            ) : null}
          </div>
        </form>
        <ReservationFilters
          query={params.q}
          status={status}
          unitId={params.unit}
          platformId={params.platform}
          startDate={startDate}
          endDate={endDate}
          sort={sort}
          units={units}
          platforms={platforms}
        />
      </div>

      {reservations.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="No reservations found"
          description={filtered ? "Nothing matches these filters. Try widening the search." : "Create a hold or confirmed booking to get started."}
          action={<Link href="/reservations/new" className={buttonClassName("clay", "md")}>New reservation</Link>}
        />
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-pine/10 bg-surface shadow-[0_1px_2px_rgba(32,58,53,0.06)]">
          <Table aria-label="Reservations" className="[&_td]:px-2.5 [&_th]:px-2.5 [&_td:first-child]:pl-4 [&_th:first-child]:pl-4">
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Status</TableHead>
                {showProperty ? <TableHead>Property</TableHead> : null}
                <TableHead>Unit</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
                <TableHead className="text-right">Nights</TableHead>
                <TableHead className="text-right">Guests</TableHead>
                <TableHead>Platform</TableHead>
                {showTotals ? <TableHead className="text-right">Total</TableHead> : null}
                <TableHead>Created at</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservations.map((reservation) => {
                const href = `/reservations/${reservation.id}`;
                const active = reservation.status === "hold" || reservation.status === "confirmed";
                return (
                  <TableRow key={reservation.id} className={cn((reservation.status === "cancelled" || reservation.status === "expired") && "text-ink/55")}>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-ink/55"><Link href={href} className="hover:text-clay">#{reservation.id.slice(0, 8).toUpperCase()}</Link></TableCell>
                    <TableCell className="max-w-48 truncate"><Link href={href} className="font-medium text-pine underline-offset-4 hover:underline">{reservation.guestName}</Link></TableCell>
                    <TableCell><ReservationStatusBadge status={reservation.status} title={reservation.status === "hold" && reservation.expiresAt ? `Hold expires ${HOLD_EXPIRY.format(reservation.expiresAt)}` : undefined} /></TableCell>
                    {showProperty ? <TableCell className="max-w-36 truncate text-ink/70">{reservation.propertyName ?? "—"}</TableCell> : null}
                    <TableCell className="max-w-36 truncate text-ink/80">{reservation.unitName}</TableCell>
                    <TableCell className="whitespace-nowrap text-ink/75">{dayLabel(reservation.checkInDate, thisYear)}</TableCell>
                    <TableCell className="whitespace-nowrap text-ink/75">{dayLabel(reservation.checkOutDate, thisYear)}</TableCell>
                    <TableCell className="text-right tabular-nums text-ink/75">{nightsBetween(reservation.checkInDate, reservation.checkOutDate)}</TableCell>
                    <TableCell className="text-right tabular-nums text-ink/75">{reservation.guestCount}</TableCell>
                    <TableCell className="max-w-36 text-ink/75" title={reservation.platformReference ? `Booking code ${reservation.platformReference}` : undefined}>
                      <PlatformBadge platform={reservation.platformName ? { name: reservation.platformName, logoUrl: reservation.platformLogoUrl, color: reservation.platformColor } : null} />
                    </TableCell>
                    {showTotals ? <TableCell className="whitespace-nowrap text-right font-medium tabular-nums text-pine">{formatPHP(reservation.bookingTotalCents ?? 0)}</TableCell> : null}
                    <TableCell className="whitespace-nowrap text-ink/65">
                      {reservation.createdAt ? <time dateTime={reservation.createdAt.toISOString()}>{CREATED_AT.format(reservation.createdAt)}</time> : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <TableActionsMenu
                        label={`reservation for ${reservation.guestName}`}
                        viewHref={href}
                        editHref={canEdit && active ? `${href}/edit` : undefined}
                        deleteLabel={`Cancel reservation for ${reservation.guestName}?`}
                        deleteDescription="This safely cancels the reservation and releases its dates. It keeps payment, task, and audit history; it does not permanently delete records."
                        destructiveActionLabel="Cancel"
                        deleteSuccessMessage="Reservation cancelled."
                        onDelete={canCancel && active ? quickCancelReservationAction.bind(null, reservation.id) : undefined}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="border-t border-pine/10 bg-linen/60 px-4 py-2.5 text-xs text-ink/55">
            {reservations.length} {reservations.length === 1 ? "reservation" : "reservations"}{status ? ` · ${RESERVATION_STATUS_LABELS[status].toLowerCase()}` : ""}{showTotals ? " · totals exclude refundable deposits" : ""}
          </p>
        </div>
      )}
    </div>
  );
}

function StatusPill({ href, active, label, count, dot }: { href: string; active: boolean; label: string; count: number; dot?: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active ? "border-primary bg-primary text-white" : "border-pine/15 bg-surface text-pine hover:border-pine/35",
      )}
    >
      {dot ? <span aria-hidden className={cn("h-2 w-2 rounded-full", dot)} /> : null}
      {label}
      <span className={cn("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-white/20 text-white" : "bg-pine/[0.07] text-ink/60")}>{count}</span>
    </Link>
  );
}
