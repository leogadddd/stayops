import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { PageHeading } from "@/components/app/page-heading";
import { PermissionDenied } from "@/components/app/permission-denied";
import { Card, CardBody } from "@/components/ui/card";
import { InviteTeamMemberForm } from "../../team-forms";

export const metadata: Metadata = { title: "Invite team member" };

export default async function InviteTeamMemberPage() {
  const membership = await requirePermission("team.create");
  if (!membership) return <PermissionDenied />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading
        title="Invite team member"
        description="Create a private invitation link for one email address. They join only after signing in with that email and accepting it within 14 days."
        backHref="/settings/team"
        backLabel="Team"
      />
      <Card className="bg-[#FFFDFA]"><CardBody><InviteTeamMemberForm /></CardBody></Card>
    </div>
  );
}
