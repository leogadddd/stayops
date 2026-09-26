import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { MailPlus } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { memberships, organizations, roles, user } from "@/lib/db/schema";
import { can, canManagePermissions, roleLabel, type RoleKey } from "@/lib/permissions";
import { getPermissionMatrix } from "@/server/orgs/permissions";
import { listOrganizationJoinRequests } from "@/server/orgs/service";
import { PermissionDenied } from "@/components/app/permission-denied";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { JoinCodeControl, JoinRequestReview, MemberActions, RolesInfoButton } from "../team-forms";

export const metadata: Metadata = { title: "Team settings" };

const ROLE_TONES: Record<RoleKey, "sage" | "clay" | "neutral"> = {
  owner: "sage",
  admin: "clay",
  operations_manager: "neutral",
  staff: "neutral",
};

export default async function TeamSettingsPage() {
  const membership = await requirePermission("team.view");
  if (!membership) return <PermissionDenied />;

  const [organization, members, requests, matrix] = await Promise.all([
    db.query.organizations.findFirst({
      columns: { defaultTimezone: true },
      where: eq(organizations.id, membership.organizationId),
    }),
    db
      .select({ membershipId: memberships.id, userId: user.id, role: roles.key, name: user.name, email: user.email })
      .from(memberships)
      .innerJoin(user, eq(memberships.userId, user.id))
      .innerJoin(roles, eq(memberships.roleId, roles.id))
      .where(eq(memberships.organizationId, membership.organizationId))
      .orderBy(asc(memberships.createdAt)),
    listOrganizationJoinRequests(membership.organizationId),
    getPermissionMatrix(membership.organizationId),
  ]);
  const canInvite = can(membership, "team.create");
  const canUpdate = can(membership, "team.update");
  const canRemove = can(membership, "team.delete");
  const requestDate = new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: organization?.defaultTimezone ?? "Asia/Manila",
  });

  return (
    <div className="min-w-0 space-y-6">
      <Card className="overflow-hidden bg-card">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-pine">Members</h2>
            <p className="mt-1 text-sm text-ink/60">People who can sign in to {membership.organizationName}.</p>
          </div>
          {canInvite ? <Link href="/settings/team/invite" className={buttonClassName("clay", "sm")}>
            <MailPlus className="h-4 w-4" aria-hidden />
            Invite team member
          </Link> : null}
        </CardHeader>
        <Table aria-label="Organization members">
          <TableHeader>
            <TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead><span className="inline-flex items-center gap-2">Role <RolesInfoButton matrix={matrix} canManage={canManagePermissions(membership.role)} /></span></TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.membershipId}>
                <TableCell className="font-medium text-pine">
                  {member.name}
                  {member.userId === membership.userId ? <span className="ml-1.5 text-xs font-normal text-ink/50">(you)</span> : null}
                </TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell><Badge tone={ROLE_TONES[member.role]}>{roleLabel(member.role)}</Badge></TableCell>
                <TableCell className="text-right">
                  {member.role !== "owner" && member.userId !== membership.userId && (canUpdate || canRemove)
                    ? <MemberActions membershipId={member.membershipId} name={member.name} role={member.role} canChangeRole={canUpdate} canRemove={canRemove} />
                    : <span className="text-ink/40" aria-label="No actions">—</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="overflow-hidden bg-card">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-pine">Pending access requests</h2>
            <p className="mt-1 max-w-xl text-sm text-ink/60">
              People who entered your organization join code. They can’t see anything until you approve them.
            </p>
          </div>
          {canInvite ? <JoinCodeControl /> : null}
        </CardHeader>
        {requests.length === 0 ? (
          <CardBody><p className="text-sm text-ink/55">No pending requests.</p></CardBody>
        ) : (
          <Table aria-label="Pending access requests">
            <TableHeader>
              <TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Requested role</TableHead><TableHead>Requested</TableHead><TableHead className="text-right">Decision</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium text-pine">{request.user.name}</TableCell>
                  <TableCell>{request.user.email}</TableCell>
                  <TableCell><Badge>{roleLabel(request.requestedRole.key)}</Badge></TableCell>
                  <TableCell><time dateTime={request.createdAt.toISOString()}>{requestDate.format(request.createdAt)}</time></TableCell>
                  <TableCell className="text-right">
                    {canUpdate
                      ? <JoinRequestReview requestId={request.id} name={request.user.name} roleName={roleLabel(request.requestedRole.key)} />
                      : <span className="text-ink/40">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

    </div>
  );
}
