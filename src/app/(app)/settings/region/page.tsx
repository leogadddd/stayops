import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { PermissionDenied } from "@/components/app/permission-denied";
import { Card, CardBody } from "@/components/ui/card";
import { RegionForm } from "../region-form";

export const metadata: Metadata = { title: "Region settings" };

export default async function RegionSettingsPage() {
  const membership = await requirePermission("organization.update");
  if (!membership) return <PermissionDenied />;
  const organization = await db.query.organizations.findFirst({ where: eq(organizations.id, membership.organizationId) });
  if (!organization) notFound();
  return <div className="min-w-0"><Card className="bg-[#FFFDFA]"><CardBody><RegionForm defaultTimezone={organization.defaultTimezone} /></CardBody></Card></div>;
}
