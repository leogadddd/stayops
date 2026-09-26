import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { RoutePage } from "@/components/app/route-page";
import { editBlockPanel } from "../../../unit-actions";

export const metadata: Metadata = { title: "Edit blocked dates" };

export default async function EditUnitBlockPage({ params }: { params: Promise<{ propertyId: string; unitId: string; blockId: string }> }) {
  const membership = await requirePermission("properties.update");
  if (!membership) return <PermissionDenied />;
  const { propertyId, unitId, blockId } = await params;
  const { form, ...panel } = await editBlockPanel(membership.organizationId, propertyId, unitId, blockId);
  return <RoutePage {...panel}>{form}</RoutePage>;
}
