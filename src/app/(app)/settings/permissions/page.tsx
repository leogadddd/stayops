import type { Metadata } from "next";
import { requireMembership } from "@/lib/auth/session";
import { canManagePermissions, editableRoles } from "@/lib/permissions";
import { getPermissionMatrix } from "@/server/orgs/permissions";
import { PermissionDenied } from "@/components/app/permission-denied";
import { PermissionMatrixEditor } from "./permission-matrix-editor";

export const metadata: Metadata = { title: "Permissions" };

export default async function PermissionsSettingsPage() {
  const membership = await requireMembership();
  if (!canManagePermissions(membership.role)) {
    return <PermissionDenied description="Only owners and admins can see and change what each role is allowed to do." />;
  }
  const matrix = await getPermissionMatrix(membership.organizationId);
  return <PermissionMatrixEditor matrix={matrix} editableRoles={editableRoles(membership.role)} actorRole={membership.role} />;
}
