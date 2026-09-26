"use server";

import { cookies } from "next/headers";
import {
  ACTIVE_ORGANIZATION_COOKIE,
  canOpenOrganization,
  isL1,
  requireUser,
} from "@/lib/auth/session";
import { searchOrganizations, type OrganizationSearchResult } from "@/server/orgs/service";

export async function selectActiveOrganization(organizationId: string) {
  const user = await requireUser();
  if (!(await canOpenOrganization(user.id, organizationId))) {
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

/** L1 only: organizations across the whole app whose name matches `query`. */
export async function searchOrganizationsAction(query: string): Promise<OrganizationSearchResult[]> {
  const user = await requireUser();
  if (!(await isL1(user.id))) return [];
  return searchOrganizations(query);
}
