"use server";

import { revalidatePath } from "next/cache";
import { requireMembership, assertCan, PermissionError } from "@/lib/auth/session";
import {
  inviteStaff,
  changeMemberRole,
  createOrganizationJoinCode,
  OrgError,
  reviewOrganizationJoinRequest,
  removeStaff,
  updateOrganizationProfile,
  updateOrganizationRegion,
  updateOrganizationName,
  updatePaymentInstructions,
  getOrganizationLogoUrl,
} from "@/server/orgs/service";
import { unexpectedErrorMessage } from "@/lib/errors";
import { INVITABLE_ROLE_KEYS, canManagePermissions, type InvitableRoleKey, type RoleKey } from "@/lib/permissions";
import { updateRolePermissions } from "@/server/orgs/permissions";
import { imageUploadFromDataUrl } from "@/server/inventory/image-upload";
import { InventoryError } from "@/server/inventory/validation";
import { createObjectStorageFromEnvironment, StorageError } from "@/server/storage/service";

export interface OrgFormState {
  error?: string;
  success?: boolean;
  invitationCode?: string;
  invitationExpiresAt?: string;
  joinCode?: string;
}

function toFormError(error: unknown): OrgFormState {
  if (error instanceof OrgError || error instanceof InventoryError || error instanceof StorageError) {
    return { error: error.message };
  }
  if (error instanceof PermissionError) {
    return { error: error.message };
  }
  return { error: unexpectedErrorMessage(error, "settings") };
}

export async function renameOrganization(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const membership = await requireMembership();
  assertCan(membership, "organization.update");
  const name = String(formData.get("name") ?? "");
  try {
    await updateOrganizationName({
      organizationId: membership.organizationId,
      name,
      actorUserId: membership.userId,
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath("/settings");
  return { success: true };
}

export async function saveOrganizationProfile(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const membership = await requireMembership();
  assertCan(membership, "organization.update");
  try {
    const removeLogo = formData.get("removeLogo") === "true";
    const logo = removeLogo
      ? undefined
      : await imageUploadFromDataUrl(String(formData.get("logoDataUrl") ?? ""));
    const currentLogoUrl = removeLogo
      ? await getOrganizationLogoUrl(membership.organizationId)
      : null;
    // The cropper always produces PNG. New uploads replace this one object.
    const logoUrl = removeLogo
      ? null
      : logo
      ? `org/${membership.organizationId}/logo/logo.webp`
      : undefined;
    if (logo && logoUrl) {
      await createObjectStorageFromEnvironment().put({ key: logoUrl, ...logo });
    }
    await updateOrganizationProfile({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      data: {
        name: String(formData.get("name") ?? ""),
        displayName: String(formData.get("displayName") ?? ""),
        logoUrl,
        contactEmail: String(formData.get("contactEmail") ?? ""),
        contactPhone: String(formData.get("contactPhone") ?? ""),
        addressLine1: String(formData.get("addressLine1") ?? ""),
        addressLine2: String(formData.get("addressLine2") ?? ""),
        city: String(formData.get("city") ?? ""),
        municipality: String(formData.get("municipality") ?? ""),
        province: String(formData.get("province") ?? ""),
        region: String(formData.get("region") ?? ""),
        country: String(formData.get("country") ?? "Philippines"),
        legalName: String(formData.get("legalName") ?? ""),
        taxId: String(formData.get("taxId") ?? ""),
      },
    });
    if (removeLogo && currentLogoUrl && !currentLogoUrl.startsWith("data:")) {
      await createObjectStorageFromEnvironment().delete(currentLogoUrl);
    }
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath("/settings");
  revalidatePath("/settings/organization");
  revalidatePath("/settings/organization/edit");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function saveOrganizationRegion(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const membership = await requireMembership();
  assertCan(membership, "organization.update");
  try {
    await updateOrganizationRegion({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      defaultTimezone: String(formData.get("defaultTimezone") ?? "Asia/Manila"),
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath("/settings/region");
  revalidatePath("/properties/new");
  revalidatePath("/audit-logs");
  return { success: true };
}

export async function savePaymentInstructions(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const membership = await requireMembership();
  assertCan(membership, "organization.update");
  try {
    await updatePaymentInstructions({
      organizationId: membership.organizationId,
      instructions: String(formData.get("paymentInstructions") ?? ""),
      actorUserId: membership.userId,
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath("/settings");
  return { success: true };
}

export async function inviteStaffAction(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const membership = await requireMembership();
  assertCan(membership, "team.create");
  try {
    const invitation = await inviteStaff({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      email: String(formData.get("email") ?? ""),
      role: (String(formData.get("role") ?? "staff") || "staff") as "admin" | "operations_manager" | "staff",
    });
    revalidatePath("/settings");
    return { success: true, invitationCode: invitation.code, invitationExpiresAt: invitation.expiresAt.toISOString() };
  } catch (error) {
    return toFormError(error);
  }
}

/** Returns a shareable code once; it is never stored in plaintext. */
export async function createOrganizationJoinCodeAction(): Promise<OrgFormState> {
  const membership = await requireMembership();
  assertCan(membership, "team.create");
  try {
    const joinCode = await createOrganizationJoinCode({ organizationId: membership.organizationId, actorUserId: membership.userId });
    return { success: true, joinCode: joinCode.code };
  } catch (error) {
    return toFormError(error);
  }
}

export async function reviewOrganizationJoinRequestAction(requestId: string, approve: boolean): Promise<OrgFormState> {
  const membership = await requireMembership();
  assertCan(membership, "team.update");
  try {
    await reviewOrganizationJoinRequest({ organizationId: membership.organizationId, actorUserId: membership.userId, requestId, approve });
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    return toFormError(error);
  }
}

export async function changeMemberRoleAction(membershipId: string, role: InvitableRoleKey): Promise<OrgFormState> {
  const membership = await requireMembership();
  assertCan(membership, "team.update");
  if (!(INVITABLE_ROLE_KEYS as readonly string[]).includes(role)) return { error: "Choose a valid role." };
  try {
    await changeMemberRole({ organizationId: membership.organizationId, actorUserId: membership.userId, membershipId, role });
    revalidatePath("/settings/team");
    return { success: true };
  } catch (error) {
    return toFormError(error);
  }
}

/** Owners and admins only; the service also limits which roles each may edit. */
export async function saveRolePermissionsAction(role: RoleKey, permissions: string[]): Promise<OrgFormState> {
  const membership = await requireMembership();
  if (!canManagePermissions(membership.role)) {
    return { error: "Only owners and admins can change permissions." };
  }
  try {
    await updateRolePermissions({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      actorRole: membership.role,
      role,
      permissions,
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath("/", "layout");
  return { success: true };
}

export async function removeStaffAction(membershipId: string): Promise<OrgFormState> {
  const membership = await requireMembership();
  assertCan(membership, "team.delete");
  try {
    await removeStaff({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      membershipId,
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath("/settings/team");
  return { success: true };
}
