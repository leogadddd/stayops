"use server";

import { revalidatePath } from "next/cache";
import { requireMembership, assertOwner, PermissionError } from "@/lib/auth/session";
import {
  inviteStaff,
  OrgError,
  removeStaff,
  updateOrganizationName,
  updatePaymentInstructions,
} from "@/server/orgs/service";

export interface OrgFormState {
  error?: string;
  success?: boolean;
}

function toFormError(error: unknown): OrgFormState {
  if (error instanceof OrgError) {
    return { error: error.message };
  }
  if (error instanceof PermissionError) {
    return { error: error.message };
  }
  throw error;
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
