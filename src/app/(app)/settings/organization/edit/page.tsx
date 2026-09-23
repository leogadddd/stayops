import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireOwner } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { PageHeading } from "@/components/app/page-heading";
import { PermissionDenied } from "@/components/app/permission-denied";
import { Card, CardBody } from "@/components/ui/card";
import { OrgNameForm } from "../../org-name-form";

export const metadata: Metadata = { title: "Edit organization" };

export default async function EditOrganizationPage() {
  const membership = await requireOwner();
  if (!membership) return <PermissionDenied />;

  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, membership.organizationId) });
  if (!org) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading title="Edit organization" description="Update the name your team sees in StayOps." backHref="/settings" backLabel="Settings" />
      <Card className="bg-[#FFFDFA]"><CardBody><OrgNameForm defaultName={org.name} /></CardBody></Card>
    </div>
  );
}
