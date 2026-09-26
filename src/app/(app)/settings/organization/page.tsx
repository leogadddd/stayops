import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { PermissionDenied } from "@/components/app/permission-denied";
import { OrganizationProfileForm } from "../org-profile-form";

export const metadata: Metadata = { title: "Organization settings" };

export default async function OrganizationSettingsPage() {
  const membership = await requirePermission("organization.update");
  if (!membership) return <PermissionDenied />;
  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, membership.organizationId),
  });
  if (!organization) notFound();

  return (
    <div className="min-w-0">
      <OrganizationProfileForm values={{
        ...organization,
        logoUrl: organization.logoUrl?.startsWith("data:")
          ? organization.logoUrl
          : organization.logoUrl ? `/api/orgs/${organization.id}/logo` : null,
      }} />
    </div>
  );
}
