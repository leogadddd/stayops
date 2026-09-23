import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { AUDIT_ACTION_LABELS } from "@/lib/labels";
import { listAuditEvents } from "@/server/audit/service";
import { PageHeading } from "@/components/app/page-heading";
import { PermissionDenied } from "@/components/app/permission-denied";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export const metadata: Metadata = { title: "Audit logs" };

const TIME_LABEL = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

export default async function AuditLogsPage() {
  const membership = await requireOwner();
  if (!membership) return <PermissionDenied />;

  const events = await listAuditEvents(membership.organizationId, 50);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading title="Audit logs" description="The latest 50 recorded actions in your organization. Times shown in Philippine time (Asia/Manila)." />
      <Card className="overflow-hidden bg-[#FFFDFA]">
        <Table aria-label="Audit logs">
          <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Action</TableHead><TableHead>Actor</TableHead></TableRow></TableHeader>
          <TableBody>
            {events.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="py-12 text-center"><p className="font-medium text-pine">No audit events yet</p><p className="mt-1 text-ink/55">Bookings, payments and other recorded actions will appear here.</p></TableCell></TableRow>
            ) : events.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="whitespace-nowrap text-ink/65"><time dateTime={event.createdAt.toISOString()}>{TIME_LABEL.format(event.createdAt)}</time></TableCell>
                <TableCell className="font-medium text-pine">{AUDIT_ACTION_LABELS[event.action] ?? event.action}</TableCell>
                <TableCell>{event.actorName ?? "Not recorded"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
