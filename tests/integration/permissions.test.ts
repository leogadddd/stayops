import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizationRolePermissions } from "@/lib/db/schema";
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";
import { listAuditEvents } from "@/server/audit/service";
import { OrgError } from "@/server/orgs/service";
import { getPermissionMatrix, updateRolePermissions } from "@/server/orgs/permissions";
import { createTestOrg } from "./helpers";

describe("organization permission matrix", () => {
  it("stores only differences from the defaults, per organization, and audits changes", async () => {
    const a = await createTestOrg("perm-a");
    const b = await createTestOrg("perm-b");
    const staffDefaults = [...DEFAULT_ROLE_PERMISSIONS.staff];

    await updateRolePermissions({
      organizationId: a.org.id, actorUserId: a.owner.id, actorRole: "owner", role: "staff",
      permissions: [...staffDefaults.filter((permission) => permission !== "damage.create"), "properties.update"],
    });
    const matrix = await getPermissionMatrix(a.org.id);
    // properties.update brings properties.view with it.
    expect(matrix.staff).toEqual(expect.arrayContaining(["properties.view", "properties.update"]));
    expect(matrix.staff).not.toContain("damage.create");
    const rows = await db.select({ permission: organizationRolePermissions.permission, allowed: organizationRolePermissions.allowed })
      .from(organizationRolePermissions).where(eq(organizationRolePermissions.organizationId, a.org.id));
    expect(rows).toHaveLength(3);
    expect(rows).toEqual(expect.arrayContaining([
      { permission: "damage.create", allowed: false },
      { permission: "properties.view", allowed: true },
      { permission: "properties.update", allowed: true },
    ]));

    // Another organization keeps the defaults.
    expect((await getPermissionMatrix(b.org.id)).staff).toEqual(staffDefaults);

    // Going back to the defaults leaves no rows behind.
    await updateRolePermissions({ organizationId: a.org.id, actorUserId: a.owner.id, actorRole: "owner", role: "staff", permissions: staffDefaults });
    expect(await db.select().from(organizationRolePermissions).where(and(eq(organizationRolePermissions.organizationId, a.org.id)))).toHaveLength(0);

    const events = (await listAuditEvents(a.org.id)).filter((event) => event.action === "organization.permissions_updated");
    expect(events).toHaveLength(2);
  });

  it("never edits the owner, and keeps admins off the admin role", async () => {
    const { org, owner } = await createTestOrg("perm-guard");
    await expect(updateRolePermissions({ organizationId: org.id, actorUserId: owner.id, actorRole: "owner", role: "owner", permissions: [] }))
      .rejects.toBeInstanceOf(OrgError);
    await expect(updateRolePermissions({ organizationId: org.id, actorUserId: owner.id, actorRole: "admin", role: "admin", permissions: [] }))
      .rejects.toBeInstanceOf(OrgError);
    await expect(updateRolePermissions({ organizationId: org.id, actorUserId: owner.id, actorRole: "operations_manager", role: "staff", permissions: [] }))
      .rejects.toBeInstanceOf(OrgError);
    await expect(updateRolePermissions({ organizationId: org.id, actorUserId: owner.id, actorRole: "admin", role: "staff", permissions: ["made.up"] }))
      .rejects.toBeInstanceOf(OrgError);
    const updated = await updateRolePermissions({ organizationId: org.id, actorUserId: owner.id, actorRole: "admin", role: "operations_manager", permissions: [] });
    expect(updated).toEqual([]);
  });
});
