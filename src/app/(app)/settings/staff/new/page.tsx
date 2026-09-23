import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { PageHeading } from "@/components/app/page-heading";
import { PermissionDenied } from "@/components/app/permission-denied";
import { Card, CardBody } from "@/components/ui/card";
import { InviteStaffForm } from "../../staff-forms";

export const metadata: Metadata = { title: "Add staff" };

export default async function NewStaffPage() {
  const membership = await requireOwner();
  if (!membership) return <PermissionDenied />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading title="Add staff" description="Give a team member access to day-to-day stay operations. Financial records and settings remain owner-only." backHref="/settings" backLabel="Settings" />
      <Card className="bg-[#FFFDFA]"><CardBody><InviteStaffForm /></CardBody></Card>
    </div>
  );
}
