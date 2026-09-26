import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberships, organizationRolePermissions, organizations, roles, systemAdmins } from "@/lib/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { can, resolvePermissions, type Permission, type RoleKey } from "@/lib/permissions";

export const ACTIVE_ORGANIZATION_COOKIE = "stayops_active_organization_id";

export type Session = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>;

/**
 * Deduplicate authentication work for one Server Component render.
 *
 * A page and its layouts commonly need the current user and membership. React
 * clears this cache for each server request, so this does not persist a
 * session between users or requests.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const requestHeaders = await headers();
  try {
    return await auth.api.getSession({ headers: requestHeaders });
  } catch (error) {
    // A failed lookup (e.g. the database is unreachable) must not crash the
    // app. The login page explains what happened and retries until the
    // session comes back.
    console.error("Failed to get session", error);
  }
  redirect("/login?session=unavailable");
});

export const requireUser = cache(async (): Promise<Session["user"]> => {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session.user;
});

export interface MembershipContext {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: RoleKey;
  userId: string;
  /** An L1 operator acting in an organization they aren't a member of (as its owner). */
  viaL1?: boolean;
  /**
   * Effective permissions in this organization. `requireMembership` always
   * sets it; when absent (hand-built contexts) the role's defaults apply.
   */
  permissions?: readonly Permission[];
}

/**
 * The tenant-scoping guard used by every app page and service call.
 * Redirects to /login when unauthenticated and /onboarding when the user
 * has no organization yet.
 */
export const requireMembership = cache(async (): Promise<MembershipContext> => {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [rows, cookieStore, l1] = await Promise.all([
    listMemberships(session.user.id),
    cookies(),
    isL1(session.user.id),
  ]);
  // The cookie is only a preference; always resolve it against this user's
  // current access before using it as a tenant boundary.
  const preferredOrganizationId = cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value;
  const own = rows.find((row) => row.organizationId === preferredOrganizationId);
  const membership = own
    ? { ...own, viaL1: false }
    : l1
      ? (await getL1Organization(preferredOrganizationId)) ?? (rows[0] ? { ...rows[0], viaL1: false } : await getL1Organization())
      : rows[0] && { ...rows[0], viaL1: false };
  if (!membership) {
    redirect("/onboarding");
  }

  return {
    ...membership,
    userId: session.user.id,
    permissions: await getRolePermissions(membership.organizationId, membership.role),
  };
});

/** The organization's permission matrix for one role, defaults merged with its overrides. */
export const getRolePermissions = cache(async (organizationId: string, role: RoleKey): Promise<Permission[]> => {
  if (role === "owner") return resolvePermissions("owner");
  const overrides = await db
    .select({ permission: organizationRolePermissions.permission, allowed: organizationRolePermissions.allowed })
    .from(organizationRolePermissions)
    .innerJoin(roles, eq(organizationRolePermissions.roleId, roles.id))
    .where(and(eq(organizationRolePermissions.organizationId, organizationId), eq(roles.key, role)));
  return resolvePermissions(role, overrides);
});

/**
 * Page guard: the membership when it holds `permission`, otherwise null so the
 * page can render a permission-denied state instead of silently redirecting.
 */
export const requirePermission = cache(async (permission: Permission): Promise<MembershipContext | null> => {
  const membership = await requireMembership();
  return can(membership, permission) ? membership : null;
});

/** Thrown by server actions when a member attempts something their role doesn't allow. */
export class PermissionError extends Error {
  constructor(message = "Your role doesn’t allow that. Ask an owner or admin for access.") {
    super(message);
    this.name = "PermissionError";
  }
}

/** Server action guard: throws a PermissionError unless the member holds `permission`. */
export function assertCan(membership: MembershipContext, permission: Permission): void {
  if (!can(membership, permission)) throw new PermissionError();
}

/** Onboarding creates the organization's first property; that flow stays with its owner. */
export function assertOwner(membership: MembershipContext): void {
  if (membership.role !== "owner") {
    throw new PermissionError("Only the organization owner can do that.");
  }
}

/** Request-scoped, so the layout and `requireMembership` share one query. */
export const listMemberships = cache(async (userId: string) => {
  return db
    .select({
      organizationId: organizations.id,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
      role: roles.key,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .innerJoin(roles, eq(memberships.roleId, roles.id))
    .where(eq(memberships.userId, userId))
    .orderBy(desc(memberships.createdAt));
});

/** Whether the user is an L1 operator (see `systemAdmins`). */
export const isL1 = cache(async (userId: string): Promise<boolean> => {
  const [row] = await db.select({ userId: systemAdmins.userId }).from(systemAdmins).where(eq(systemAdmins.userId, userId)).limit(1);
  return Boolean(row);
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * An organization as an L1 operator opens it: with owner access and no
 * membership. Without an id, the first organization by name, for an L1
 * who belongs to none and hasn't picked one yet.
 */
async function getL1Organization(organizationId?: string) {
  if (organizationId !== undefined && !UUID.test(organizationId)) return null;
  const [row] = await db
    .select({ organizationId: organizations.id, organizationName: organizations.name, organizationSlug: organizations.slug })
    .from(organizations)
    .where(organizationId ? eq(organizations.id, organizationId) : undefined)
    .orderBy(asc(organizations.name))
    .limit(1);
  return row ? { ...row, role: "owner" as RoleKey, viaL1: true } : null;
}

/** Whether the user may switch to this organization: a member, or L1. */
export async function canOpenOrganization(userId: string, organizationId: string): Promise<boolean> {
  const rows = await listMemberships(userId);
  if (rows.some((row) => row.organizationId === organizationId)) return true;
  return (await isL1(userId)) && (await getL1Organization(organizationId)) !== null;
}

/** Whether the user has somewhere to work: a membership, or L1 access. */
export async function hasOrganizationAccess(userId: string): Promise<boolean> {
  if ((await listMemberships(userId)).length) return true;
  return (await isL1(userId)) && (await getL1Organization()) !== null;
}
