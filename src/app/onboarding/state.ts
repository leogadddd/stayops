import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { listMemberships } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { organizationJoinRequests, organizations } from "@/lib/db/schema";
import { listOrgUnits, listProperties } from "@/server/inventory/service";

export type OnboardingMembership = Awaited<ReturnType<typeof listMemberships>>[number];
type Property = Awaited<ReturnType<typeof listProperties>>[number];
type Unit = Awaited<ReturnType<typeof listOrgUnits>>[number];

export interface OnboardingState {
  membership: OnboardingMembership | null;
  /** The earliest property: the one onboarding created and edits. */
  property: Property | null;
  /** The earliest unit of that property. */
  unit: Unit | null;
}

function earliest<T extends { createdAt: Date }>(rows: T[]): T | null {
  return rows.reduce<T | null>(
    (first, row) => (!first || row.createdAt < first.createdAt ? row : first),
    null,
  );
}

/**
 * Where a user is in onboarding, read from what already exists: an
 * organization, then a property, then a unit. Nothing extra is stored, so a
 * reload or a half-finished attempt resumes at the right step, and going back
 * edits what was already created.
 */
export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const [membership] = await listMemberships(userId);
  if (!membership) return { membership: null, property: null, unit: null };
  const [properties, units] = await Promise.all([
    listProperties(membership.organizationId),
    listOrgUnits(membership.organizationId),
  ]);
  const property = earliest(properties);
  const unit = property
    ? earliest(units.filter((row) => row.propertyId === property.id))
    : null;
  return { membership, property, unit };
}

/** The first step still missing. Staff skip straight to the dashboard. */
export function nextOnboardingPath(state: OnboardingState): string {
  if (!state.membership) return "/onboarding/organization";
  if (state.membership.role !== "owner") return "/dashboard";
  if (!state.property) return "/onboarding/property";
  if (!state.unit) return "/onboarding/unit";
  return "/onboarding/welcome";
}

/** Redirect target for a step whose earlier steps aren't done, or null to show it. */
export function guardOnboardingStep(
  state: OnboardingState,
  step: "organization" | "property" | "unit",
): string | null {
  if (state.membership && state.membership.role !== "owner") return "/dashboard";
  if (step === "property" && !state.membership) return "/onboarding/organization";
  if (step === "unit" && !state.property) return nextOnboardingPath(state);
  return null;
}

/**
 * Join requests this user sent that an owner hasn't reviewed yet. The user
 * already had each organization's code, so showing its name leaks nothing.
 */
export async function listPendingJoinRequests(userId: string) {
  return db
    .select({ id: organizationJoinRequests.id, organizationName: organizations.name, createdAt: organizationJoinRequests.createdAt })
    .from(organizationJoinRequests)
    .innerJoin(organizations, eq(organizationJoinRequests.organizationId, organizations.id))
    .where(and(eq(organizationJoinRequests.userId, userId), eq(organizationJoinRequests.status, "pending")))
    .orderBy(desc(organizationJoinRequests.updatedAt));
}
