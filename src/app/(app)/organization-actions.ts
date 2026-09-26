"use server";

import { cookies } from "next/headers";
import {
  ACTIVE_ORGANIZATION_COOKIE,
  canOpenOrganization,
  isL1,
  requireUser,
} from "@/lib/auth/session";
import { findOrganizationsByIds, searchOrganizations, type OrganizationSearchResult } from "@/server/orgs/service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/**
 * L1 only: which of the browser's recent picks still exist, in the given
 * order and under their current names. Recents can outlive an organization
 * or come from another database.
 */
export async function resolveRecentOrganizationsAction(ids: string[]): Promise<OrganizationSearchResult[]> {
  const user = await requireUser();
  if (!(await isL1(user.id))) return [];
  const wanted = ids.filter((id) => typeof id === "string" && UUID.test(id)).slice(0, 10);
  const found = new Map((await findOrganizationsByIds(wanted)).map((row) => [row.id, row]));
  return wanted.flatMap((id) => found.get(id) ?? []);
}
