import Link from "next/link";
import type { Metadata } from "next";
import { CalendarPlus, Flag, ListChecks, Plus, Search } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { PermissionDenied } from "@/components/app/permission-denied";
import { formatPHP } from "@/lib/money";
import { cn } from "@/lib/utils";
import { GUEST_ACTIVITIES, GUEST_DIRECTORY_SHOWS, GUEST_SORTS, listGuestDirectory, type GuestActivity, type GuestDirectoryShow, type GuestSort } from "@/server/reservations/service";
import { Button, buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableActionsMenu } from "@/components/ui/table-actions-menu";
import { PageHeading } from "@/components/app/page-heading";
import { deleteGuestAction } from "./actions";
import { GUEST_ACTIVITY_LABELS, GUEST_ACTIVITY_STYLES, GuestActivityBadge, GuestAvatar, GuestTags } from "./guest-display";

export const metadata: Metadata = { title: "Guests" };

const DATE_LABEL = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" });
const DATE_WITH_YEAR = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
// Profiles are stamped in UTC; show when they were added in the operators' local time.
const ADDED_WITH_YEAR = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });
const YEAR = new Intl.DateTimeFormat("en-PH", { year: "numeric", timeZone: "Asia/Manila" });

/** "Oct 20" this year; "Oct 20, 2027" otherwise, so the column stays narrow. */
function dayLabel(date: string | null, thisYear: string) {
  if (!date) return "—";
  const value = new Date(`${date}T00:00:00Z`);
  return date.startsWith(thisYear) ? DATE_LABEL.format(value) : DATE_WITH_YEAR.format(value);
}

const SHOW_LABELS: Record<GuestDirectoryShow, string> = {
  missing_email: "Missing email",
  missing_phone: "Missing phone",
  flagged: "Flagged",
  marketing: "Agreed to promotions",
};

const SORT_LABELS: Record<GuestSort, string> = {
  name: "Name (A–Z)",
  recent: "Most recent booking",
  stays: "Most stays",
  added: "Newest profile",
};

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; activity?: string; show?: string; sort?: string }>;
}) {
  const membership = await requirePermission("guests.view");
  if (!membership) return <PermissionDenied />;
  const params = await searchParams;
  const showSpend = can(membership, "payments.view");
  const canCreate = can(membership, "guests.create");
  const canEdit = can(membership, "guests.update");
  const canDelete = can(membership, "guests.delete");
  const canBook = can(membership, "reservations.create");
  const canSeeReservations = can(membership, "reservations.view");

  const activity = GUEST_ACTIVITIES.includes(params.activity as GuestActivity) ? (params.activity as GuestActivity) : undefined;
  const show = GUEST_DIRECTORY_SHOWS.includes(params.show as GuestDirectoryShow) ? (params.show as GuestDirectoryShow) : undefined;
  const sort = GUEST_SORTS.includes(params.sort as GuestSort) ? (params.sort as GuestSort) : "name";

  // Loaded without the activity filter so the activity pills can show counts.
  const allGuests = await listGuestDirectory(membership.organizationId, { query: params.q, show, sort, includeSpend: showSpend });
  const guests = activity ? allGuests.filter((guest) => guest.activity === activity) : allGuests;
  const counts = new Map<GuestActivity, number>();
  for (const guest of allGuests) counts.set(guest.activity, (counts.get(guest.activity) ?? 0) + 1);
  const thisYear = YEAR.format(new Date());

  const hrefWith = (patch: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    const next = { q: params.q, activity, show, sort: sort === "name" ? undefined : sort, ...patch };
    for (const [key, value] of Object.entries(next)) if (value) query.set(key, value);
    const text = query.toString();
    return text ? `/guests?${text}` : "/guests";
  };
  const filtered = Boolean(params.q || activity || show);

  return (
    <div className="min-w-0 overflow-hidden">
      <PageHeading title="Guests" description="The people behind every stay: contact details, booking history and notes.">
        {canCreate ? (
          <Link href="/guests/new" className={buttonClassName("clay", "md")}>
            <Plus className="h-4 w-4" aria-hidden />
            Add guest
          </Link>
        ) : null}
      </PageHeading>

      <nav aria-label="Filter by activity" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [mask-image:linear-gradient(to_right,#000_calc(100%-2.5rem),transparent)] pr-10 sm:pr-0 sm:[mask-image:none] sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
        <ActivityPill href={hrefWith({ activity: undefined })} active={!activity} label="All" count={allGuests.length} />
        {GUEST_ACTIVITIES.map((value) => (
          <ActivityPill key={value} href={hrefWith({ activity: value })} active={activity === value} label={GUEST_ACTIVITY_LABELS[value]} count={counts.get(value) ?? 0} dot={GUEST_ACTIVITY_STYLES[value].dot} />
        ))}
      </nav>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-pine/10 bg-surface p-4 shadow-[0_1px_2px_rgba(32,58,53,0.06)]">
        {activity ? <input type="hidden" name="activity" value={activity} /> : null}
        <div className="min-w-56 flex-1">
          <label htmlFor="q" className="mb-1.5 block text-sm font-medium text-ink">Search guest</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pine/45" aria-hidden />
            <Input id="q" name="q" defaultValue={params.q ?? ""} placeholder="Name, email or phone" className="pl-9" />
          </div>
        </div>
        <div className="w-full sm:w-52">
          <label htmlFor="show" className="mb-1.5 block text-sm font-medium text-ink">Show</label>
          <Select id="show" name="show" defaultValue={show ?? ""}>
            <option value="">Everyone</option>
            {GUEST_DIRECTORY_SHOWS.map((value) => <option key={value} value={value}>{SHOW_LABELS[value]}</option>)}
          </Select>
        </div>
        <div className="w-full sm:w-52">
          <label htmlFor="sort" className="mb-1.5 block text-sm font-medium text-ink">Sort by</label>
          <Select id="sort" name="sort" defaultValue={sort}>
            {GUEST_SORTS.map((value) => <option key={value} value={value}>{SORT_LABELS[value]}</option>)}
          </Select>
        </div>
        <Button type="submit" variant="outline" size="md">Apply</Button>
        {filtered || sort !== "name" ? <Link href="/guests" className="pb-2.5 text-sm text-pine/70 underline-offset-4 hover:text-pine hover:underline">Clear</Link> : null}
      </form>

      {guests.length === 0 ? (
        <EmptyState
          className="mt-8"
          title={filtered ? "No guests match" : "No guests yet"}
          description={filtered ? "Nothing matches these filters. Try widening the search." : "Guests appear here once you add them or book a stay for them."}
          action={canCreate ? <Link href="/guests/new" className={buttonClassName("clay", "md")}>Add guest</Link> : undefined}
        />
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-pine/10 bg-surface shadow-[0_1px_2px_rgba(32,58,53,0.06)]">
          <Table aria-label="Guests" className="[&_td]:px-2.5 [&_th]:px-2.5 [&_td:first-child]:pl-4 [&_th:first-child]:pl-4">
            <TableHeader>
              <TableRow>
                <TableHead>Guest</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Stays</TableHead>
                <TableHead className="text-right">Nights</TableHead>
                {showSpend ? <TableHead className="text-right">Booked value</TableHead> : null}
                <TableHead>Next stay</TableHead>
                <TableHead>Last stay</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {guests.map((guest) => {
                const href = `/guests/${guest.id}`;
                const links = [
                  ...(canBook ? [{ href: `/reservations/new?guest=${guest.id}`, label: "New reservation", icon: <CalendarPlus className="h-4 w-4" aria-hidden /> }] : []),
                  ...(canSeeReservations && guest.reservationCount ? [{ href: `/reservations?q=${encodeURIComponent(guest.email ?? guest.phone ?? guest.name)}`, label: "Reservations", icon: <ListChecks className="h-4 w-4" aria-hidden /> }] : []),
                ];
                return (
                  <TableRow key={guest.id}>
                    <TableCell>
                      <div className="flex min-w-44 max-w-64 items-center gap-2.5">
                        <GuestAvatar name={guest.name} />
                        <Link href={href} className="truncate font-medium text-pine underline-offset-4 hover:underline">{guest.name}</Link>
                        {guest.flagged ? <span title={guest.flagReason ?? "Flagged"} className="shrink-0"><Flag className="h-4 w-4 text-clay" aria-label="Flagged" /></span> : null}
                      </div>
                    </TableCell>
                    <TableCell><GuestActivityBadge activity={guest.activity} /></TableCell>
                    <TableCell className="max-w-56 truncate text-ink/70">{guest.email ? <a href={`mailto:${guest.email}`} className="hover:text-clay">{guest.email}</a> : <Missing />}</TableCell>
                    <TableCell className="whitespace-nowrap text-ink/70">{guest.phone ? <a href={`tel:${guest.phone.replace(/\s+/g, "")}`} className="hover:text-clay">{guest.phone}</a> : <Missing />}</TableCell>
                    <TableCell className="text-right tabular-nums text-ink/75" title={guest.reservationCount > guest.stayCount ? `${guest.reservationCount - guest.stayCount} more cancelled, expired or on hold` : undefined}>{guest.stayCount}</TableCell>
                    <TableCell className="text-right tabular-nums text-ink/75">{guest.nights}</TableCell>
                    {showSpend ? <TableCell className="whitespace-nowrap text-right font-medium tabular-nums text-pine">{guest.spentCents ? formatPHP(guest.spentCents) : <span className="font-normal text-ink/40">—</span>}</TableCell> : null}
                    <TableCell className="whitespace-nowrap text-ink/75">{dayLabel(guest.nextCheckIn, thisYear)}</TableCell>
                    <TableCell className="whitespace-nowrap text-ink/65">{dayLabel(guest.lastCheckOut, thisYear)}</TableCell>
                    <TableCell className="min-w-28 max-w-56">{guest.tags.length ? <GuestTags tags={guest.tags} className="flex-nowrap overflow-hidden" /> : <Missing />}</TableCell>
                    <TableCell className="max-w-56 truncate text-ink/60" title={guest.notes ?? undefined}>{guest.notes ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-ink/65">{ADDED_WITH_YEAR.format(guest.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <TableActionsMenu
                        label={guest.name}
                        viewHref={href}
                        editHref={canEdit ? `${href}/edit` : undefined}
                        links={links}
                        deleteLabel={`Delete ${guest.name}?`}
                        deleteDescription="This permanently removes the guest profile. Only guests who have never had a reservation can be deleted."
                        deleteSuccessMessage="Guest deleted."
                        onDelete={canDelete && guest.reservationCount === 0 ? deleteGuestAction.bind(null, guest.id) : undefined}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="border-t border-pine/10 bg-linen/60 px-4 py-2.5 text-xs text-ink/55">
            {guests.length} {guests.length === 1 ? "guest" : "guests"}{activity ? ` · ${GUEST_ACTIVITY_LABELS[activity].toLowerCase()}` : ""} · stays and nights count kept bookings only{showSpend ? "; booked value excludes refundable deposits" : ""}
          </p>
        </div>
      )}
    </div>
  );
}

function Missing() {
  return <span className="text-ink/35">—</span>;
}

function ActivityPill({ href, active, label, count, dot }: { href: string; active: boolean; label: string; count: number; dot?: string }) {
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
