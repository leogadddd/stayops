"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { OrgError, acceptInvitation, getInvitationForUser, requestOrganizationAccess } from "@/server/orgs/service";

export type InvitationActionState = {
  error?: string;
  success?: boolean;
  organizationName?: string;
  roleName?: string;
  invitationCode?: string;
};

function message(error: unknown): InvitationActionState {
  return { error: error instanceof OrgError ? error.message : "We could not process that invitation. Please try again." };
}

/** Looks up an email-bound invite for the signed-in account. */
export async function inspectInvitationAction(
  _previous: InvitationActionState,
  formData: FormData,
): Promise<InvitationActionState> {
  const currentUser = await requireUser();
  const code = String(formData.get("code") ?? "");
  try {
    const invitation = await getInvitationForUser({ code, email: currentUser.email });
    return { organizationName: invitation.organization.name, roleName: invitation.role.name, invitationCode: code };
  } catch (error) {
    return message(error);
  }
}

export async function acceptInvitationAction(code: string): Promise<InvitationActionState> {
  const currentUser = await requireUser();
  try {
    await acceptInvitation({ code, userId: currentUser.id, email: currentUser.email });
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    return message(error);
  }
}

/** Creates a pending owner-approved request from a reusable organization code. */
export async function requestOrganizationAccessAction(
  _previous: InvitationActionState,
  formData: FormData,
): Promise<InvitationActionState> {
  const currentUser = await requireUser();
  try {
    await requestOrganizationAccess({ code: String(formData.get("code") ?? ""), userId: currentUser.id });
    return { success: true };
  } catch (error) {
    return message(error);
  }
}
