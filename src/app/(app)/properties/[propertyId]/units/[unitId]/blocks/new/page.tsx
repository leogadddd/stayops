import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { RoutePage } from "@/components/app/route-page";
import { blockPanel } from "../../unit-actions";

export const metadata: Metadata = { title: "Block dates" };

export default async function NewUnitBlockPage({ params }: { params: Promise<{ propertyId: string; unitId: string }> }) {
  const membership = await requireOwner();
  if (!membership) return <PermissionDenied />;
  const { propertyId, unitId } = await params;
  const { form, ...panel } = await blockPanel(membership.organizationId, propertyId, unitId);
  return <RoutePage {...panel}>{form}</RoutePage>;
}
