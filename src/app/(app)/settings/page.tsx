import { db } from "@/lib/db";
import { memberships, organizations, user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireMembership } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { OrgNameForm } from "./org-name-form";
import { PaymentInstructionsForm } from "./payment-instructions-form";

export default async function SettingsPage() {
  const membership = await requireMembership();

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, membership.organizationId),
  });

  const members = await db
    .select({ role: memberships.role, name: user.name, email: user.email })
    .from(memberships)
    .innerJoin(user, eq(memberships.userId, user.id))
    .where(eq(memberships.organizationId, membership.organizationId));

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
              key={member.email}
              className="flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{member.name}</p>
                <p className="truncate text-xs text-ink/50">{member.email}</p>
              </div>
              <Badge tone={member.role === "owner" ? "sage" : "neutral"}>
                {member.role === "owner" ? "Owner" : "Staff"}
              </Badge>
            </div>
          ))}
          <p className="border-t border-pine/10 pt-3 text-xs text-ink/50">
            Staff invitations arrive with the reports &amp; permissions slice.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
