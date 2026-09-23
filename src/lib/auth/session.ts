import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberships, organizations } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export type Session = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>;

export async function getSession(): Promise<Session | null> {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireUser(): Promise<Session["user"]> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session.user;
}

export interface MembershipContext {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: "owner" | "staff";
  userId: string;
}

/**
 * The tenant-scoping guard used by every app page and service call.
 * Redirects to /login when unauthenticated and /onboarding when the user
 * has no organization yet.
 */
export async function requireMembership(): Promise<MembershipContext> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const rows = await db
    .select({
      organizationId: organizations.id,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(eq(memberships.userId, session.user.id))
    .orderBy(desc(memberships.createdAt))
    .limit(1);

  const membership = rows[0];
  if (!membership) {
    redirect("/onboarding");
  }

  return {
    ...membership,
    userId: session.user.id,
  };
}

/**
 * Owner-only guard for money, reports, settings and staff management. Returns
 * null for staff members so callers can render a permission-denied state
 * instead of silently redirecting.
 */
export async function requireOwner(): Promise<MembershipContext | null> {
  const membership = await requireMembership();
  return membership.role === "owner" ? membership : null;
}

/** Thrown by server actions when a staff member attempts an owner-only mutation. */
export class PermissionError extends Error {
  constructor(message = "Only the organization owner can do that.") {
    super(message);
    this.name = "PermissionError";
  }
}

export function assertOwner(membership: MembershipContext): void {
  if (membership.role !== "owner") {
    throw new PermissionError();
  }
}

export async function listMemberships(userId: string) {
  return db
    .select({
      organizationId: organizations.id,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(eq(memberships.userId, userId));
}
