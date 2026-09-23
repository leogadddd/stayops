import { db } from "@/lib/db";
import { memberships, organizations, user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireOwner } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { AUDIT_ACTION_LABELS } from "@/lib/labels";
import { listAuditEvents } from "@/server/audit/service";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { OrgNameForm } from "./org-name-form";
import { PaymentInstructionsForm } from "./payment-instructions-form";
import { InviteStaffForm, RemoveStaffButton } from "./staff-forms";

const TIME_LABEL = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
});

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

  const activity = await listAuditEvents(membership.organizationId, 50);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-3xl text-pine">Settings</h1>
        <p className="mt-1 text-sm text-ink/60">
          Organization, members and housekeeping.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-medium text-pine">Organization</h2>
        </CardHeader>
        <CardBody>
          <OrgNameForm defaultName={org?.name ?? ""} />
          <p className="mt-3 text-xs text-ink/50">
            Slug: <code className="rounded bg-pine-mist px-1.5 py-0.5">{org?.slug}</code>
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-medium text-pine">Guest payments</h2>
        </CardHeader>
        <CardBody>
          <PaymentInstructionsForm
            defaultValue={org?.paymentInstructions ?? ""}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-medium text-pine">Members</h2>
        </CardHeader>
        <CardBody className="space-y-3">
          {members.map((member) => (
            <div
              key={member.membershipId}
              className="flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{member.name}</p>
                <p className="truncate text-xs text-ink/50">{member.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={member.role === "owner" ? "sage" : "neutral"}>
                  {member.role === "owner" ? "Owner" : "Staff"}
                </Badge>
                {member.role === "staff" ? (
                  <RemoveStaffButton
                    membershipId={member.membershipId}
                    name={member.name}
                  />
                ) : null}
              </div>
            </div>
          ))}
          <p className="border-t border-pine/10 pt-3 text-xs text-ink/50">
            Staff can view the calendar, reservations, guests and tasks, and can
            check guests in and out, complete turnover items and report damage.
            Payments, refunds, expenses, reports and these settings stay
            owner-only.
          </p>
          <div className="border-t border-pine/10 pt-3">
            <InviteStaffForm />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-medium text-pine">Activity</h2>
        </CardHeader>
        <CardBody>
          {activity.length === 0 ? (
            <p className="text-sm text-ink/55">
              Nothing has happened yet. Actions like bookings, payments and
              check-ins will show up here.
            </p>
          ) : (
            <ol className="space-y-3">
              {activity.map((event) => (
                <li
                  key={event.id}
                  className="flex items-baseline justify-between gap-3"
                >
                  <p className="min-w-0 text-sm text-pine">
                    {AUDIT_ACTION_LABELS[event.action] ?? event.action}
                    {event.actorName ? (
                      <span className="text-ink/50"> · {event.actorName}</span>
                    ) : null}
                  </p>
                  <p className="shrink-0 text-xs text-ink/40">
                    {TIME_LABEL.format(event.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
