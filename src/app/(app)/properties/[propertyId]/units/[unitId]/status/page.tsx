import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { RoutePage } from "@/components/app/route-page";
import { statusPanel } from "../unit-actions";

export const metadata: Metadata = { title: "Change unit status" };

export default async function UnitStatusPage({ params }: { params: Promise<{ propertyId: string; unitId: string }> }) {
  const membership = await requirePermission("properties.update");
  if (!membership) return <PermissionDenied />;
  const { propertyId, unitId } = await params;
  const { form, ...panel } = await statusPanel(membership.organizationId, propertyId, unitId);
  return <RoutePage {...panel}>{form}</RoutePage>;
}
