/**
 * The permission matrix: what each role can see and do, per area of the app.
 *
 * `DEFAULT_ROLE_PERMISSIONS` is what every organization starts with. Owners
 * and admins can change the non-owner roles per organization; those changes
 * are stored as overrides in `organization_role_permissions` and merged with
 * these defaults by `resolvePermissions`. The owner always has everything.
 *
 * The global `role_permissions` table seeded by an earlier migration predates
 * this catalogue and is not read.
 */
export const ROLE_KEYS = ["owner", "admin", "operations_manager", "staff"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

/** Roles an owner can hand out; ownership is never granted by invitation. */
export const INVITABLE_ROLE_KEYS = ["admin", "operations_manager", "staff"] as const satisfies readonly RoleKey[];
export type InvitableRoleKey = (typeof INVITABLE_ROLE_KEYS)[number];

export const PERMISSION_ACTIONS = ["view", "create", "update", "delete"] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const ACTION_LABELS: Record<PermissionAction, string> = {
  view: "See",
  create: "Create",
  update: "Update",
  delete: "Remove",
};

/**
 * Every area and the actions it supports, with what each action allows in the
 * words the matrix shows. An action missing from an area doesn't exist there.
 */
export const PERMISSION_AREAS = [
  {
    area: "reservations",
    label: "Reservations",
    actions: {
      view: "See reservations, the calendar and availability",
      create: "Place reservation holds",
      update: "Confirm holds and edit reservations",
      delete: "Cancel reservations",
    },
  },
  {
    area: "stays",
    label: "Check-in & check-out",
    actions: { update: "Check guests in and out" },
  },
  {
    area: "payments",
    label: "Rates & payments",
    actions: {
      view: "See rates, totals, balances and payment history",
      create: "Record payments, refunds and deposit deductions, and set custom charges",
      update: "Review guest payment proofs",
    },
  },
  {
    area: "guests",
    label: "Guests",
    actions: {
      view: "See the guest list",
      update: "Share and revoke private guest links",
    },
  },
  {
    area: "tasks",
    label: "Turnover tasks",
    actions: {
      view: "See turnover tasks",
      update: "Complete checklists, add notes and mark units ready",
    },
  },
  {
    area: "damage",
    label: "Damage reports",
    actions: {
      create: "Report damage",
      update: "Resolve damage, and mark a unit ready while damage is open",
    },
  },
  {
    area: "properties",
    label: "Properties & units",
    actions: {
      view: "See properties, units, blocks and checklists",
      create: "Add properties, units and date blocks",
      update: "Edit properties, units, blocks, checklists and house rules",
      delete: "Delete properties, units and date blocks",
    },
  },
  {
    area: "expenses",
    label: "Expenses",
    actions: { view: "See expenses", create: "Record expenses" },
  },
  {
    area: "reports",
    label: "Reports",
    actions: { view: "See financial reports" },
  },
  {
    area: "audit_logs",
    label: "Audit logs",
    actions: { view: "See the audit log" },
  },
  {
    area: "organization",
    label: "Organization settings",
    actions: { update: "Edit the organization profile, region and guest payment instructions" },
  },
  {
    area: "team",
    label: "Team",
    actions: {
      view: "See members and pending access requests",
      create: "Invite members and create join codes",
      update: "Change member roles and approve access requests",
      delete: "Remove members",
    },
  },
] as const satisfies readonly {
  area: string;
  label: string;
  actions: Partial<Record<PermissionAction, string>>;
}[];

type Area = (typeof PERMISSION_AREAS)[number];
export type PermissionArea = Area["area"];
export type Permission = {
  [A in Area as A["area"]]: `${A["area"]}.${Extract<keyof A["actions"], PermissionAction>}`;
}[PermissionArea];

export const PERMISSIONS: readonly Permission[] = PERMISSION_AREAS.flatMap((group) =>
  PERMISSION_ACTIONS.filter((action) => action in group.actions).map((action) => `${group.area}.${action}` as Permission),
);

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

export function permissionDescription(permission: Permission): string {
  const [area, action] = permission.split(".") as [PermissionArea, PermissionAction];
  const group = PERMISSION_AREAS.find((candidate) => candidate.area === area)!;
  return (group.actions as Partial<Record<PermissionAction, string>>)[action] ?? permission;
}

/** Defaults that match how StayOps behaved before roles were configurable. */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, readonly Permission[]> = {
  owner: PERMISSIONS,
  admin: PERMISSIONS,
  operations_manager: PERMISSIONS.filter(
    (permission) => !permission.startsWith("team.") && !permission.startsWith("organization.")
      && permission !== "reports.view" && permission !== "audit_logs.view",
  ),
  staff: [
    "reservations.view",
    "reservations.create",
    "stays.update",
    "guests.view",
    "tasks.view",
    "tasks.update",
    "damage.create",
  ],
};

export const ROLE_DETAILS: Record<RoleKey, { name: string; description: string }> = {
  owner: { name: "Owner", description: "Full control of the organization. Can’t be restricted." },
  admin: { name: "Admin", description: "Runs the organization and team, and can adjust these permissions." },
  operations_manager: { name: "Operations Manager", description: "Manages properties, stays, payments, inventory, tasks and expenses." },
  staff: { name: "Staff", description: "Handles day-to-day tasks and operational updates." },
};

export function roleLabel(role: RoleKey): string {
  return ROLE_DETAILS[role].name;
}

/**
 * Seeing an area is required for anything else in it, so granting an action
 * grants `view` and removing `view` removes the rest.
 */
export function normalizePermissions(granted: Iterable<Permission>): Permission[] {
  const set = new Set(granted);
  for (const permission of [...set]) {
    const [area, action] = permission.split(".");
    const view = `${area}.view`;
    if (action !== "view" && isPermission(view)) set.add(view);
  }
  return PERMISSIONS.filter((permission) => {
    if (!set.has(permission)) return false;
    const [area] = permission.split(".");
    const view = `${area}.view`;
    return !isPermission(view) || set.has(view);
  });
}

/** The role's effective permissions: defaults with the organization's overrides applied. */
export function resolvePermissions(
  role: RoleKey,
  overrides: readonly { permission: string; allowed: boolean }[] = [],
): Permission[] {
  if (role === "owner") return [...PERMISSIONS];
  const granted = new Set<Permission>(DEFAULT_ROLE_PERMISSIONS[role]);
  for (const override of overrides) {
    if (!isPermission(override.permission)) continue;
    if (override.allowed) granted.add(override.permission);
    else granted.delete(override.permission);
  }
  return normalizePermissions(granted);
}

/**
 * Whether a member holds `permission`. `permissions` is what the session
 * loaded for their organization; without it the role's defaults apply.
 */
export function can(member: { role: RoleKey; permissions?: readonly Permission[] }, permission: Permission): boolean {
  return (member.permissions ?? resolvePermissions(member.role)).includes(permission);
}

/** Who may open and change the permission matrix. Fixed, so nobody can lock it away. */
export function canManagePermissions(role: RoleKey): boolean {
  return role === "owner" || role === "admin";
}

/** Roles whose permissions `actorRole` may edit. Admins can't change their own role's grants. */
export function editableRoles(actorRole: RoleKey): Exclude<RoleKey, "owner">[] {
  if (actorRole === "owner") return ["admin", "operations_manager", "staff"];
  if (actorRole === "admin") return ["operations_manager", "staff"];
  return [];
}
