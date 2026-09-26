import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { RoutePage } from "@/components/app/route-page";
import { houseRulesPanel } from "../property-actions";

export const metadata: Metadata = { title: "House rules" };

export default async function HouseRulesPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const membership = await requirePermission("properties.update");
  if (!membership) return <PermissionDenied />;
  const { propertyId } = await params;
  const { form, ...panel } = await houseRulesPanel(membership.organizationId, propertyId);
  return <RoutePage {...panel}>{form}</RoutePage>;
}
