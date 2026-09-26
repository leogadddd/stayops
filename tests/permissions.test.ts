import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  can,
  canManagePermissions,
  editableRoles,
  normalizePermissions,
  resolvePermissions,
} from "@/lib/permissions";

describe("permission matrix", () => {
  it("gives the owner everything, whatever the overrides say", () => {
    expect(resolvePermissions("owner", [{ permission: "team.view", allowed: false }])).toEqual([...PERMISSIONS]);
  });

  it("keeps staff to day-to-day work by default", () => {
    const staff = resolvePermissions("staff");
    expect(staff).toEqual(expect.arrayContaining(["reservations.view", "reservations.create", "stays.update", "tasks.update", "damage.create"]));
    for (const permission of ["payments.view", "properties.view", "expenses.view", "reports.view", "team.view", "organization.update"] as const) {
      expect(staff).not.toContain(permission);
    }
  });

  it("applies grants and revocations on top of the defaults", () => {
    const staff = resolvePermissions("staff", [
      { permission: "properties.update", allowed: true },
      { permission: "damage.create", allowed: false },
      { permission: "not.a.permission", allowed: true },
    ]);
    expect(staff).toContain("properties.update");
    // Updating an area needs seeing it.
    expect(staff).toContain("properties.view");
    expect(staff).not.toContain("damage.create");
    expect(staff).not.toContain("not.a.permission");
  });

  it("drops every action in an area whose view is removed", () => {
    expect(normalizePermissions(["team.create", "team.delete"])).toEqual(["team.view", "team.create", "team.delete"]);
    const withoutView = resolvePermissions("admin", [{ permission: "team.view", allowed: false }]);
    expect(withoutView.filter((permission) => permission.startsWith("team."))).toEqual([]);
  });

  it("falls back to the role's defaults when a membership has no loaded permissions", () => {
    expect(can({ role: "operations_manager" }, "properties.delete")).toBe(true);
    expect(can({ role: "operations_manager" }, "team.view")).toBe(false);
    expect(can({ role: "staff", permissions: ["reports.view"] }, "reports.view")).toBe(true);
    expect(can({ role: "staff", permissions: ["reports.view"] }, "tasks.view")).toBe(false);
  });

  it("lets only owners and admins manage the matrix, and keeps admins off their own role", () => {
    expect(canManagePermissions("owner")).toBe(true);
    expect(canManagePermissions("admin")).toBe(true);
    expect(canManagePermissions("operations_manager")).toBe(false);
    expect(editableRoles("owner")).toEqual(["admin", "operations_manager", "staff"]);
    expect(editableRoles("admin")).toEqual(["operations_manager", "staff"]);
    expect(editableRoles("staff")).toEqual([]);
  });

  it("uses only known permissions in the defaults", () => {
    for (const permissions of Object.values(DEFAULT_ROLE_PERMISSIONS)) {
      for (const permission of permissions) expect(PERMISSIONS).toContain(permission);
      expect(normalizePermissions(permissions)).toEqual(PERMISSIONS.filter((p) => permissions.includes(p)));
    }
  });
});
