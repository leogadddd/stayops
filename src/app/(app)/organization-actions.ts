"use server";

import { cookies } from "next/headers";
import {
  ACTIVE_ORGANIZATION_COOKIE,
  listAccessibleOrganizations,
  requireUser,
} from "@/lib/auth/session";

export async function selectActiveOrganization(organizationId: string) {
  const user = await requireUser();
  const memberships = await listAccessibleOrganizations(user.id);
  if (!memberships.some((membership) => membership.organizationId === organizationId)) {
    return { error: "You do not have access to that organization." };
  }
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORGANIZATION_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return { success: true };
}
