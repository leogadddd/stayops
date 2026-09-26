import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { RoutePage } from "@/components/app/route-page";
import { checklistPanel } from "../../unit-actions";

export const metadata: Metadata = { title: "Edit turnover checklist" };

export default async function EditChecklistPage({ params }: { params: Promise<{ propertyId: string; unitId: string }> }) {
  const membership = await requirePermission("properties.update");
  if (!membership) return <PermissionDenied />;
  const { propertyId, unitId } = await params;
  const { form, ...panel } = await checklistPanel(membership.organizationId, propertyId, unitId);
  return <RoutePage {...panel}>{form}</RoutePage>;
}
