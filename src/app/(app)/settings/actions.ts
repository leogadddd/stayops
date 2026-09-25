"use server";

import { revalidatePath } from "next/cache";
import { requireMembership, assertOwner, PermissionError } from "@/lib/auth/session";
import {
  inviteStaff,
  OrgError,
  removeStaff,
  updateOrganizationProfile,
  updateOrganizationRegion,
  updateOrganizationName,
  updatePaymentInstructions,
} from "@/server/orgs/service";
import { unexpectedErrorMessage } from "@/lib/errors";
import { imageDataUrlFromValue } from "@/server/inventory/image-upload";
import { InventoryError } from "@/server/inventory/validation";

export interface OrgFormState {
  error?: string;
  success?: boolean;
}

function toFormError(error: unknown): OrgFormState {
  if (error instanceof OrgError || error instanceof InventoryError) {
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
  assertOwner(membership);
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
  assertOwner(membership);
  try {
    const logoUrl = imageDataUrlFromValue(String(formData.get("logoDataUrl") ?? ""));
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
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function saveOrganizationRegion(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const membership = await requireMembership();
  assertOwner(membership);
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
  revalidatePath("/settings/properties/new");
  revalidatePath("/audit-logs");
  return { success: true };
}

export async function savePaymentInstructions(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const membership = await requireMembership();
  assertOwner(membership);
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
  assertOwner(membership);
  try {
    await inviteStaff({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      email: String(formData.get("email") ?? ""),
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath("/settings");
  return { success: true };
}

export async function removeStaffAction(membershipId: string): Promise<void> {
  const membership = await requireMembership();
  assertOwner(membership);
  await removeStaff({
    organizationId: membership.organizationId,
    actorUserId: membership.userId,
    membershipId,
  });
  revalidatePath("/settings");
}
