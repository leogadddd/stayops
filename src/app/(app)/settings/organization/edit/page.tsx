import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { PermissionDenied } from "@/components/app/permission-denied";
import { OrganizationProfileForm } from "../../org-profile-form";

export const metadata: Metadata = { title: "Edit organization" };

export default async function EditOrganizationPage() {
  const membership = await requirePermission("organization.update");
  if (!membership) return <PermissionDenied />;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, membership.organizationId),
  });
  if (!org) notFound();

  return (
    <div className="min-w-0">
      <OrganizationProfileForm values={{
        ...org,
        logoUrl: org.logoUrl?.startsWith("data:")
          ? org.logoUrl
          : org.logoUrl ? `/api/orgs/${org.id}/logo` : null,
      }} />
    </div>
  );
}
