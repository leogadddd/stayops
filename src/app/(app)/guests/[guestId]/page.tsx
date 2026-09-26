import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, BedDouble, CalendarCheck, CalendarPlus, Flag, Mail, MapPin, Moon, NotebookPen, Pencil, Phone, Wallet } from "lucide-react";
import { GUEST_ID_TYPE_LABELS, type GuestIdType } from "@/lib/guests";
import { PlatformBadge } from "@/components/app/platform-badge";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { PermissionDenied } from "@/components/app/permission-denied";
import { nightsBetween } from "@/lib/dates";
import { formatPHP } from "@/lib/money";
import { cn } from "@/lib/utils";
import { getGuestOrThrow, listReservations, ReservationError } from "@/server/reservations/service";
import { buttonClassName } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReservationStatusBadge } from "@/components/app/reservation-status-badge";
import { Panel, StatTile } from "../../properties/inventory-display";
import { GuestActivityBadge, GuestAvatar, GuestTags } from "../guest-display";
import { DeleteGuestButton } from "./delete-guest-button";

export const metadata: Metadata = { title: "Guest" };

const DATE_WITH_YEAR = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const ADDED = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });
const BIRTH_DATE = new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "UTC" });

/** Whole years from `birthDate` to today. */
function age(birthDate: string) {
  const today = new Date().toISOString().slice(0, 10);
  const years = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4));
  return today.slice(5) < birthDate.slice(5) ? years - 1 : years;
}
const KEPT = new Set(["confirmed", "checked_in", "checked_out"]);

function dayLabel(date: string) {
  return DATE_WITH_YEAR.format(new Date(`${date}T00:00:00Z`));
}

export default async function GuestDetailPage({ params }: { params: Promise<{ guestId: string }> }) {
  const membership = await requirePermission("guests.view");
  if (!membership) return <PermissionDenied />;

  const { guestId } = await params;
  let guest;
  try {
    guest = await getGuestOrThrow(membership.organizationId, guestId);
  } catch (error) {
    if (error instanceof ReservationError) notFound();
    throw error;
  }
  const showTotals = can(membership, "payments.view");
  const canSeeReservations = can(membership, "reservations.view");
  const reservations = canSeeReservations
    ? await listReservations(membership.organizationId, { guestId: guest.id, includeTotals: showTotals })
    : [];

  const kept = reservations.filter((reservation) => KEPT.has(reservation.status));
  const nights = kept.reduce((sum, reservation) => sum + nightsBetween(reservation.checkInDate, reservation.checkOutDate), 0);
  const bookedValue = kept.reduce((sum, reservation) => sum + (reservation.bookingTotalCents ?? 0), 0);
  const next = reservations
    .filter((reservation) => reservation.status === "hold" || reservation.status === "confirmed")
    .sort((a, b) => a.checkInDate.localeCompare(b.checkInDate))[0];
  const lastCheckOut = reservations.find((reservation) => reservation.status === "checked_out")?.checkOutDate;
  const activity = reservations.some((reservation) => reservation.status === "checked_in")
    ? "in_house"
    : next ? "upcoming" : lastCheckOut ? "past" : "no_stays";
  const showProperty = new Set(reservations.map((reservation) => reservation.propertyName)).size > 1;
  const href = `/guests/${guest.id}`;

  return (
    <div className="min-w-0 overflow-hidden">
      <Link href="/guests" className="mb-4 inline-flex items-center gap-2 text-sm text-pine/70 hover:text-clay">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All guests
      </Link>

      <section className="@container overflow-hidden rounded-2xl border border-pine/10 bg-surface p-5 shadow-[0_1px_2px_rgba(32,58,53,0.06)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <GuestAvatar name={guest.name} size="lg" />
            <div className="min-w-0">
              <h1 className="truncate font-display text-3xl tracking-tight text-pine sm:text-4xl">{guest.name}</h1>
              {guest.preferredName ? <p className="text-sm text-ink/55">Goes by {guest.preferredName}</p> : null}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink/65">
                {canSeeReservations ? <GuestActivityBadge activity={activity} /> : null}
                <span>Guest since {ADDED.format(guest.createdAt)}</span>
              </div>
              <GuestTags tags={guest.tags} className="mt-2.5" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {can(membership, "reservations.create") ? (
              <Link href={`/reservations/new?guest=${guest.id}`} className={buttonClassName("clay", "md")}>
                <CalendarPlus className="h-4 w-4" aria-hidden />
                New reservation
              </Link>
            ) : null}
            {can(membership, "guests.update") ? (
              <Link href={`${href}/edit`} className={buttonClassName("outline", "md")}>
                <Pencil className="h-4 w-4" aria-hidden />
                Edit
              </Link>
            ) : null}
            {can(membership, "guests.delete") && canSeeReservations && reservations.length === 0 ? <DeleteGuestButton guestId={guest.id} name={guest.name} /> : null}
          </div>
        </div>

        {guest.flagged ? (
          <p role="note" className="mt-5 flex items-start gap-2 rounded-xl bg-clay-mist px-4 py-3 text-sm text-clay-deep">
            <Flag className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span><span className="font-medium">Flagged guest.</span> {guest.flagReason ?? "Check with the team before rebooking."}</span>
          </p>
        ) : null}

        {canSeeReservations ? (
          <dl className="mt-5 grid grid-cols-2 gap-2.5 @3xl:grid-cols-4">
            <StatTile icon={BedDouble} label="Stays" value={String(kept.length)} detail={`${reservations.length} reservations in all`} />
            <StatTile icon={Moon} label="Nights" value={String(nights)} detail="Across kept stays" />
            {showTotals ? <StatTile icon={Wallet} label="Booked value" value={formatPHP(bookedValue)} detail="Excludes deposits" /> : null}
            <StatTile
              icon={CalendarCheck}
              label="Next stay"
              value={next ? dayLabel(next.checkInDate) : "None booked"}
              detail={next ? next.unitName : lastCheckOut ? `Last left ${dayLabel(lastCheckOut)}` : undefined}
              tone={activity === "in_house" ? "sage" : undefined}
            />
          </dl>
        ) : null}
      </section>

      <div className="mt-6 grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0">
          {canSeeReservations ? (
            <Panel title={`Reservations (${reservations.length})`} description="Every hold and booking under this guest, latest stay first." flush>
              {reservations.length ? (
                <Table aria-label={`Reservations for ${guest.name}`} className="[&_td]:px-2.5 [&_th]:px-2.5 [&_td:first-child]:pl-5 [&_th:first-child]:pl-5 sm:[&_td:first-child]:pl-6 sm:[&_th:first-child]:pl-6">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ref</TableHead>
                      <TableHead>Status</TableHead>
                      {showProperty ? <TableHead>Property</TableHead> : null}
                      <TableHead>Unit</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead className="text-right">Nights</TableHead>
                      <TableHead className="text-right">Guests</TableHead>
                      <TableHead>Platform</TableHead>
                      {showTotals ? <TableHead className="text-right">Total</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservations.map((reservation) => {
                      const reservationHref = `/reservations/${reservation.id}`;
                      return (
                        <TableRow key={reservation.id} className={cn((reservation.status === "cancelled" || reservation.status === "expired") && "text-ink/55")}>
                          <TableCell className="whitespace-nowrap font-mono text-xs text-ink/55"><Link href={reservationHref} className="hover:text-clay">#{reservation.id.slice(0, 8).toUpperCase()}</Link></TableCell>
                          <TableCell><ReservationStatusBadge status={reservation.status} /></TableCell>
                          {showProperty ? <TableCell className="max-w-36 truncate text-ink/70">{reservation.propertyName ?? "—"}</TableCell> : null}
                          <TableCell className="max-w-36 truncate"><Link href={reservationHref} className="font-medium text-pine underline-offset-4 hover:underline">{reservation.unitName}</Link></TableCell>
                          <TableCell className="whitespace-nowrap text-ink/75">{dayLabel(reservation.checkInDate)}</TableCell>
                          <TableCell className="text-right tabular-nums text-ink/75">{nightsBetween(reservation.checkInDate, reservation.checkOutDate)}</TableCell>
                          <TableCell className="text-right tabular-nums text-ink/75">{reservation.guestCount}</TableCell>
                          <TableCell className="max-w-36 text-ink/75" title={reservation.platformReference ? `Booking code ${reservation.platformReference}` : undefined}>
                            <PlatformBadge platform={reservation.platformName ? { name: reservation.platformName, logoUrl: reservation.platformLogoUrl, color: reservation.platformColor } : null} />
                          </TableCell>
                          {showTotals ? <TableCell className="whitespace-nowrap text-right font-medium tabular-nums text-pine">{formatPHP(reservation.bookingTotalCents ?? 0)}</TableCell> : null}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="border-t border-pine/8 px-5 py-6 text-sm text-ink/55 sm:px-6">No reservations yet.</p>
              )}
            </Panel>
          ) : null}
        </div>

        <aside className="min-w-0 space-y-6 lg:sticky lg:top-0">
          <Panel title="Contact">
            <dl className="space-y-3 text-sm">
              <ContactRow icon={Mail} label="Email" value={guest.email} href={guest.email ? `mailto:${guest.email}` : undefined} />
              <ContactRow icon={Phone} label="Phone" value={guest.phone} href={guest.phone ? `tel:${guest.phone.replace(/\s+/g, "")}` : undefined} />
              <ContactRow icon={MapPin} label="Address" value={guest.address} />
            </dl>
            <p className="mt-4 border-t border-pine/8 pt-3 text-xs text-ink/55">{guest.marketingOptIn ? "Agreed to promotions." : "Hasn't agreed to promotions."}</p>
          </Panel>
          <Panel title="Profile">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <ProfileItem label="Birth date" value={guest.birthDate ? `${BIRTH_DATE.format(new Date(`${guest.birthDate}T00:00:00Z`))} · ${age(guest.birthDate)}` : null} wide />
              <ProfileItem label="Nationality" value={guest.nationality} />
              <ProfileItem label="ID" value={guest.idType ? GUEST_ID_TYPE_LABELS[guest.idType as GuestIdType] ?? guest.idType : null} />
              <ProfileItem label="ID number" value={guest.idNumber} wide />
              <ProfileItem label="Emergency contact" value={guest.emergencyContactName ? `${guest.emergencyContactName}${guest.emergencyContactPhone ? ` · ${guest.emergencyContactPhone}` : ""}` : guest.emergencyContactPhone} wide />
              <ProfileItem label="Company" value={guest.company} />
              <ProfileItem label="TIN" value={guest.tin} />
            </dl>
          </Panel>
          <Panel title="Notes" description="Private to your team.">
            {guest.notes ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink/75">{guest.notes}</p>
            ) : (
              <p className="flex items-center gap-2 text-sm text-ink/45">
                <NotebookPen className="h-4 w-4" aria-hidden />
                No notes yet.
              </p>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function ProfileItem({ label, value, wide = false }: { label: string; value: string | null; wide?: boolean }) {
  return (
    <div className={cn("min-w-0", wide && "col-span-2")}>
      <dt className="text-xs uppercase tracking-wide text-ink/45">{label}</dt>
      <dd className={cn("mt-0.5 break-words", value ? "font-medium text-pine" : "text-ink/40")}>{value || "Not added"}</dd>
    </div>
  );
}

function ContactRow({ icon: Icon, label, value, href }: { icon: typeof Mail; label: string; value: string | null; href?: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-pine/40" aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs uppercase tracking-wide text-ink/45">{label}</dt>
        <dd className="break-words font-medium text-pine">{value ? (href ? <a href={href} className="hover:text-clay">{value}</a> : <span className="whitespace-pre-line">{value}</span>) : <span className="font-normal text-ink/40">Not added</span>}</dd>
      </div>
    </div>
  );
}
