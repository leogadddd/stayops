import { DateInput } from "@/components/ui/date-input";
import Link from "next/link";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { formatAuditDetails, formatAuditTarget } from "@/lib/audit";
import { isLocalDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AUDIT_ACTION_LABELS } from "@/lib/labels";
import { getAuditLogPage } from "@/server/audit/service";
import { PageHeading } from "@/components/app/page-heading";
import { PermissionDenied } from "@/components/app/permission-denied";
import { Button, buttonClassName } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "Audit logs" };

type AuditSearchParams = { action?: string; actor?: string; startDate?: string; endDate?: string; page?: string };

export default async function AuditLogsPage({ searchParams = Promise.resolve({}) }: { searchParams?: Promise<AuditSearchParams> } = {}) {
  const membership = await requirePermission("audit_logs.view");
  if (!membership) return <PermissionDenied />;

  const params = await searchParams;
  const organization = await db.query.organizations.findFirst({ where: eq(organizations.id, membership.organizationId) });
  const timeLabel = new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: organization?.defaultTimezone ?? "Asia/Manila",
  });
  const action = params.action?.trim() || undefined;
  const actor = params.actor?.trim() || undefined;
  const startDate = params.startDate && isLocalDate(params.startDate) ? params.startDate : undefined;
  const endDate = params.endDate && isLocalDate(params.endDate) ? params.endDate : undefined;
  const parsedPage = Number(params.page);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const { events, total, page: currentPage, pageSize } = await getAuditLogPage(membership.organizationId, { action, actor, startDate, endDate, page });
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const firstEvent = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastEvent = Math.min(currentPage * pageSize, total);
  const filtered = Boolean(action || actor || startDate || endDate);

  const hrefWith = (patch: Partial<AuditSearchParams>) => {
    const next = { action, actor, startDate, endDate, page: currentPage > 1 ? String(currentPage) : undefined, ...patch };
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) if (value) query.set(key, value);
    const text = query.toString();
    return text ? `/audit-logs?${text}` : "/audit-logs";
  };

  return (
    <div className="min-w-0 overflow-hidden">
      <PageHeading title="Audit logs" description={`Recorded activity in your organization. Times shown in ${organization?.defaultTimezone ?? "Asia/Manila"}.`} />

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-pine/10 bg-white p-4 shadow-[0_1px_2px_rgba(32,58,53,0.06)]">
        <div className="min-w-48 flex-1"><label htmlFor="audit-action" className="mb-1.5 block text-sm font-medium text-ink">Action</label><Input id="audit-action" name="action" defaultValue={action ?? ""} placeholder="e.g. payment or reservation" /></div>
        <div className="min-w-48 flex-1"><label htmlFor="audit-actor" className="mb-1.5 block text-sm font-medium text-ink">Performed by</label><Input id="audit-actor" name="actor" defaultValue={actor ?? ""} placeholder="Team member name" /></div>
        <div className="w-full sm:w-44"><label htmlFor="audit-start-date" className="mb-1.5 block text-sm font-medium text-ink">Start date</label><DateInput id="audit-start-date" name="startDate" defaultValue={startDate ?? ""} clearable placeholder="Any" /></div>
        <div className="w-full sm:w-44"><label htmlFor="audit-end-date" className="mb-1.5 block text-sm font-medium text-ink">End date</label><DateInput id="audit-end-date" name="endDate" defaultValue={endDate ?? ""} clearable placeholder="Any" /></div>
        <Button type="submit" variant="outline" size="md">Apply</Button>
        {filtered ? <Link href="/audit-logs" className="pb-2.5 text-sm text-pine/70 underline-offset-4 hover:text-pine hover:underline">Clear</Link> : null}
      </form>

      <div className="mt-4 overflow-hidden rounded-2xl border border-pine/10 bg-white shadow-[0_1px_2px_rgba(32,58,53,0.06)]">
        <Table aria-label="Audit logs" className="[&_td]:px-2.5 [&_th]:px-2.5 [&_td:first-child]:pl-4 [&_th:first-child]:pl-4">
          <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Activity</TableHead><TableHead>Target</TableHead><TableHead>Actor</TableHead></TableRow></TableHeader>
          <TableBody>
            {events.length === 0 ? <TableRow><TableCell colSpan={4} className="py-12 text-center"><p className="font-medium text-pine">No audit events found</p><p className="mt-1 text-ink/55">{filtered ? "Try widening the filters." : "Bookings, payments and other recorded actions will appear here."}</p></TableCell></TableRow> : events.map((event) => {
              const details = formatAuditDetails(event);
              const target = formatAuditTarget(event);
              const actorLabel = event.actorName ?? (event.action === "payment_proof.submitted" ? "Guest portal" : event.actorUserId ? "Former user" : "System");
              return <TableRow key={event.id}>
                <TableCell className="whitespace-nowrap align-top text-ink/65"><time dateTime={event.createdAt.toISOString()}>{timeLabel.format(event.createdAt)}</time></TableCell>
                <TableCell className="min-w-56 align-top"><p className="font-medium text-pine">{AUDIT_ACTION_LABELS[event.action] ?? event.action}</p>{details ? <p className="mt-1 max-w-md text-sm leading-relaxed text-ink/55">{details}</p> : null}</TableCell>
                <TableCell className="min-w-40 align-top"><p className="font-medium text-pine">{target.label}</p><p className="mt-1 text-xs text-ink/45">{target.kind}</p></TableCell>
                <TableCell className="whitespace-nowrap align-top">{actorLabel}</TableCell>
              </TableRow>;
            })}
          </TableBody>
        </Table>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-pine/10 bg-linen/60 px-4 py-2.5">
          <p className="text-xs text-ink/55">{total === 0 ? "No events" : `Showing ${firstEvent}–${lastEvent} of ${total} events`}</p>
          {total > pageSize ? <nav aria-label="Audit log pagination" className="flex items-center gap-2">
            {currentPage > 1 ? <Link href={hrefWith({ page: String(currentPage - 1) })} className={buttonClassName("outline", "sm")}>Previous</Link> : <Button type="button" variant="outline" size="sm" disabled>Previous</Button>}
            <span className="text-xs tabular-nums text-ink/60">Page {currentPage} of {lastPage}</span>
            {currentPage < lastPage ? <Link href={hrefWith({ page: String(currentPage + 1) })} className={buttonClassName("outline", "sm")}>Next</Link> : <Button type="button" variant="outline" size="sm" disabled>Next</Button>}
          </nav> : null}
        </div>
      </div>
    </div>
  );
}
