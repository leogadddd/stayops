/**
 * Canonical permission matrix. The migration seeds the same grants in
 * role_permissions, making permissions inspectable and ready for a database
 * backed custom-role implementation later.
 */
export const ROLE_KEYS = ["owner", "admin", "operations_manager", "staff"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const PERMISSIONS = [
  "organization.manage",
  "team.manage",
  "billing.manage",
  "reports.view",
  "properties.manage",
  "reservations.manage",
  "expenses.manage",
  "operations.manage",
  "inventory.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSION_MATRIX: Record<RoleKey, readonly Permission[]> = {
  owner: PERMISSIONS,
  admin: ["organization.manage", "team.manage", "reports.view", "properties.manage", "reservations.manage", "expenses.manage", "operations.manage", "inventory.manage"],
  operations_manager: ["properties.manage", "reservations.manage", "expenses.manage", "operations.manage", "inventory.manage"],
  staff: ["operations.manage"],
};

export const ROLE_DETAILS: Record<RoleKey, { name: string; description: string }> = {
  owner: { name: "Owner", description: "Full control, including billing and ownership-sensitive settings." },
  admin: { name: "Admin", description: "Runs the organization and team, excluding billing and ownership." },
  operations_manager: { name: "Operations Manager", description: "Manages properties, stays, inventory, tasks, and expenses." },
  staff: { name: "Staff", description: "Handles day-to-day tasks and operational updates." },
};

export function hasRolePermission(role: RoleKey, permission: Permission): boolean {
  return ROLE_PERMISSION_MATRIX[role].includes(permission);
}
