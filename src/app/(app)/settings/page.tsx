import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { memberships, organizations, user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireOwner } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { PageHeading } from "@/components/app/page-heading";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { RemoveStaffButton } from "./staff-forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const membership = await requireOwner();
  if (!membership) return <PermissionDenied />;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, membership.organizationId),
  });
  const members = await db
    .select({
      membershipId: memberships.id,
      role: memberships.role,
      name: user.name,
      email: user.email,
    })
    .from(memberships)
    .innerJoin(user, eq(memberships.userId, user.id))
    .where(eq(memberships.organizationId, membership.organizationId));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeading title="Settings" description="Your organization, guest payment instructions and team access." />

      <Card className="bg-[#FFFDFA]">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-pine">Organization</h2>
          <Link href="/settings/organization/edit" className={buttonClassName("outline", "sm")}>Edit organization</Link>
        </CardHeader>
        <CardBody>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-ink/55">Name</dt><dd className="mt-1 font-medium text-pine">{org?.name ?? membership.organizationName}</dd></div>
            <div><dt className="text-ink/55">Slug</dt><dd className="mt-1 text-pine">{org?.slug ?? membership.organizationSlug}</dd></div>
          </dl>
        </CardBody>
      </Card>

      <Card className="bg-[#FFFDFA]">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-pine">Guest payments</h2>
          <Link href="/settings/payment-instructions/edit" className={buttonClassName("outline", "sm")}>Edit instructions</Link>
        </CardHeader>
        <CardBody>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink/75">{org?.paymentInstructions || "No payment instructions yet."}</p>
          <p className="mt-3 text-xs text-ink/55">These instructions appear on guests’ private booking pages.</p>
        </CardBody>
      </Card>

      <Card className="overflow-hidden bg-[#FFFDFA]">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-pine">Members</h2>
          <Link href="/settings/staff/new" className={buttonClassName("clay", "sm")}><Plus className="h-4 w-4" aria-hidden />Add staff</Link>
        </CardHeader>
        <Table aria-label="Organization members">
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {members.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-ink/55">No members found.</TableCell></TableRow> : members.map((member) => (
              <TableRow key={member.membershipId}>
                <TableCell className="font-medium text-pine">{member.name}</TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell><Badge tone={member.role === "owner" ? "sage" : "neutral"}>{member.role === "owner" ? "Owner" : "Staff"}</Badge></TableCell>
                <TableCell className="text-right">{member.role === "staff" ? <RemoveStaffButton membershipId={member.membershipId} name={member.name} /> : <span className="text-ink/40">—</span>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <CardBody className="border-t border-pine/10">
          <p className="text-xs leading-relaxed text-ink/55">Staff can view the calendar, reservations, guests and tasks, check guests in and out, complete turnover items and report damage. Payments, refunds, expenses, reports and settings remain owner-only.</p>
        </CardBody>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Link href="/settings/properties" className={buttonClassName("outline")}>Manage properties & units</Link>
        <Link href="/audit-logs" className={buttonClassName("ghost")}>View audit logs</Link>
      </div>
    </div>
  );
}
