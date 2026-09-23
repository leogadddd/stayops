"use server";

import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/auth/session";
import { OrgError, updateOrganizationName } from "@/server/orgs/service";

export interface OrgFormState {
  error?: string;
  success?: boolean;
}

export async function renameOrganization(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const membership = await requireMembership();
  const name = String(formData.get("name") ?? "");
  try {
    await updateOrganizationName({
      organizationId: membership.organizationId,
      name,
      actorUserId: membership.userId,
    });
  } catch (error) {
    if (error instanceof OrgError) {
      return { error: error.message };
    }
    throw error;
  }
  revalidatePath("/settings");
  return { success: true };
}
