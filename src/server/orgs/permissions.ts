import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditEvents, organizationRolePermissions, roles } from "@/lib/db/schema";
import {
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_KEYS,
  editableRoles,
  isPermission,
  normalizePermissions,
  resolvePermissions,
  type Permission,
  type RoleKey,
} from "@/lib/permissions";
import { OrgError } from "./service";

export type PermissionMatrix = Record<RoleKey, Permission[]>;

/** Every role's effective permissions in one organization. */
export async function getPermissionMatrix(organizationId: string): Promise<PermissionMatrix> {
  const overrides = await db
    .select({ role: roles.key, permission: organizationRolePermissions.permission, allowed: organizationRolePermissions.allowed })
    .from(organizationRolePermissions)
    .innerJoin(roles, eq(organizationRolePermissions.roleId, roles.id))
    .where(eq(organizationRolePermissions.organizationId, organizationId));
  return Object.fromEntries(
    ROLE_KEYS.map((role) => [role, resolvePermissions(role, overrides.filter((row) => row.role === role))]),
  ) as PermissionMatrix;
}

/**
 * Replace one role's permissions in an organization. Only differences from
 * the defaults are stored, so matching the defaults again leaves no rows.
 */
export async function updateRolePermissions(input: {
  organizationId: string;
  actorUserId: string;
  actorRole: RoleKey;
  role: RoleKey;
  permissions: readonly string[];
}): Promise<Permission[]> {
  if (input.role === "owner") throw new OrgError("The owner always has every permission.");
  if (!editableRoles(input.actorRole).includes(input.role)) {
    throw new OrgError(input.actorRole === "admin"
      ? "Admins can’t change the Admin role’s permissions. Ask the owner."
      : "Your role can’t change permissions.");
  }
  const unknown = input.permissions.filter((permission) => !isPermission(permission));
  if (unknown.length) throw new OrgError(`Unknown permission: ${unknown[0]}.`);

  const next = normalizePermissions(input.permissions as Permission[]);
  const defaults = new Set(DEFAULT_ROLE_PERMISSIONS[input.role]);
  const nextSet = new Set(next);

  return db.transaction(async (tx) => {
    const [role] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.key, input.role)).limit(1);
    if (!role) throw new OrgError("Role configuration is missing. Run database migrations and seeds.");
    const scope = and(eq(organizationRolePermissions.organizationId, input.organizationId), eq(organizationRolePermissions.roleId, role.id));

    const before = resolvePermissions(
      input.role,
      await tx.select({ permission: organizationRolePermissions.permission, allowed: organizationRolePermissions.allowed })
        .from(organizationRolePermissions).where(scope),
    );
    const granted = next.filter((permission) => !before.includes(permission));
    const revoked = before.filter((permission) => !nextSet.has(permission));
    if (!granted.length && !revoked.length) return next;

    await tx.delete(organizationRolePermissions).where(scope);
    const overrides = [...new Set([...defaults, ...next])]
      .filter((permission) => defaults.has(permission) !== nextSet.has(permission))
      .map((permission) => ({
        organizationId: input.organizationId,
        roleId: role.id,
        permission,
        allowed: nextSet.has(permission),
        updatedByUserId: input.actorUserId,
      }));
    if (overrides.length) await tx.insert(organizationRolePermissions).values(overrides);

    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "organization",
      entityId: input.organizationId,
      action: "organization.permissions_updated",
      metadata: { role: input.role, granted, revoked },
    });
    return next;
  });
}
