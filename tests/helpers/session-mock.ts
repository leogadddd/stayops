import { vi } from "vitest";
import { can, type Permission } from "@/lib/permissions";
import type { MembershipContext } from "@/lib/auth/session";

/**
 * A `requirePermission` that follows the mocked `requireMembership`, like the
 * real guard: the membership when its role (or `permissions`) allows it,
 * otherwise null. A plain function, so `vi.resetAllMocks` keeps it working.
 */
export function permissionGuardFor(requireMembership: () => Promise<MembershipContext>) {
  return async (permission: Permission) => {
    const membership = await requireMembership();
    return can(membership, permission) ? membership : null;
  };
}

/** Session module mock with a `requireMembership` spy and a matching `requirePermission`. */
export function mockSessionModule(extra: Record<string, unknown> = {}) {
  const requireMembership = vi.fn<() => Promise<MembershipContext>>();
  return { requireMembership, requirePermission: permissionGuardFor(() => requireMembership()), ...extra };
}
