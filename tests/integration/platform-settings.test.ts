import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { systemAdmins } from "@/lib/db/schema";
import { canOpenOrganization, hasOrganizationAccess, listMemberships } from "@/lib/auth/session";
import { searchOrganizations } from "@/server/orgs/service";
import { createHold } from "@/server/reservations/service";
import {
  createPlatform,
  listManagedPlatforms,
  listPlatforms,
  movePlatform,
  PlatformError,
  removePlatform,
  restorePlatform,
  seedDefaultPlatforms,
  updatePlatform,
} from "@/server/reservations/platforms";
import { createActiveUnit, createTestOrg, createTestProperty, createTestUser, stayDates } from "./helpers";

const CUSTOM = { name: "TikTok", color: "#000000", websiteUrl: "https://www.tiktok.com", commissionBasisPoints: null, collectsPayment: false };

describe("platform settings", () => {
  it("adds, edits and reorders an organization's own platforms", async () => {
    const { org, owner } = await createTestOrg("platform-settings");
    const args = { organizationId: org.id, actorUserId: owner.id };
    const tiktok = await createPlatform({ ...args, data: CUSTOM });
    expect((await listPlatforms(org.id)).at(-1)?.name).toBe("TikTok");
    await expect(createPlatform({ ...args, data: { ...CUSTOM, name: "tiktok" } })).rejects.toThrow("already a platform called");

    await updatePlatform({ ...args, platformId: tiktok.id, data: { ...CUSTOM, commissionBasisPoints: 500, collectsPayment: true } });
    expect((await listManagedPlatforms(org.id)).find((row) => row.id === tiktok.id)).toMatchObject({ commissionBasisPoints: 500, collectsPayment: true });

    await movePlatform({ ...args, platformId: tiktok.id, direction: "up" });
    const names = (await listPlatforms(org.id)).map((row) => row.name);
    expect(names.indexOf("TikTok")).toBe(names.length - 2);

    // Another organization never sees it.
    const other = await createTestOrg("platform-settings-other");
    expect((await listPlatforms(other.org.id)).some((row) => row.name === "TikTok")).toBe(false);
    await expect(updatePlatform({ organizationId: other.org.id, actorUserId: other.owner.id, platformId: tiktok.id, data: CUSTOM })).rejects.toBeInstanceOf(PlatformError);
  });

  it("deletes an unused custom platform, and archives built-in or used ones", async () => {
    const { org, owner } = await createTestOrg("platform-remove");
    const args = { organizationId: org.id, actorUserId: owner.id };
    const custom = await createPlatform({ ...args, data: CUSTOM });
    expect(await removePlatform({ ...args, platformId: custom.id })).toEqual({ archived: false });
    expect((await listManagedPlatforms(org.id)).some((row) => row.id === custom.id)).toBe(false);

    const agoda = (await listPlatforms(org.id)).find((row) => row.name === "Agoda")!;
    expect(await removePlatform({ ...args, platformId: agoda.id })).toEqual({ archived: true });
    expect((await listPlatforms(org.id)).some((row) => row.id === agoda.id)).toBe(false);
    // Reseeding doesn't bring a removed default back.
    expect(await seedDefaultPlatforms(db, org.id)).toBe(0);

    const used = await createPlatform({ ...args, data: { ...CUSTOM, name: "Travel agent" } });
    const property = await createTestProperty(org.id, owner.id);
    const unit = await createActiveUnit(org.id, owner.id, property.id);
    const { checkIn, checkOut } = stayDates(40);
    await createHold({ ...args, guest: { newGuest: { name: "Ana Santos", email: "ana@example.com" } }, data: { unitId: unit.id, checkIn, checkOut, guestCount: 1, holdMinutes: 30, platformId: used.id, charges: [{ type: "accommodation", description: "Nightly rate", quantity: 2, unitAmountCents: 250_000 }] } });
    expect(await removePlatform({ ...args, platformId: used.id })).toEqual({ archived: true });
    expect((await listManagedPlatforms(org.id)).find((row) => row.id === used.id)).toMatchObject({ isActive: false, reservationCount: 1 });

    await restorePlatform({ ...args, platformId: agoda.id });
    expect((await listPlatforms(org.id)).at(-1)?.id).toBe(agoda.id);
  });

  it("keeps at least one platform", async () => {
    const { org, owner } = await createTestOrg("platform-last");
    const args = { organizationId: org.id, actorUserId: owner.id };
    const platforms = await listPlatforms(org.id);
    for (const platform of platforms.slice(1)) await removePlatform({ ...args, platformId: platform.id });
    await expect(removePlatform({ ...args, platformId: platforms[0]!.id })).rejects.toThrow("at least one platform");
  });
});

describe("L1 operators", () => {
  it("can open and search every organization without being a member", async () => {
    const first = await createTestOrg("l1-first");
    const second = await createTestOrg("l1-second");
    const operator = await createTestUser("l1-operator");
    expect(await hasOrganizationAccess(operator.id)).toBe(false);
    expect(await canOpenOrganization(operator.id, first.org.id)).toBe(false);

    await db.insert(systemAdmins).values({ userId: operator.id });
    expect(await hasOrganizationAccess(operator.id)).toBe(true);
    expect(await canOpenOrganization(operator.id, first.org.id)).toBe(true);
    expect(await canOpenOrganization(operator.id, second.org.id)).toBe(true);
    expect(await canOpenOrganization(operator.id, "not-a-uuid")).toBe(false);
    // Not a member: onboarding and team lists still see no membership.
    expect(await listMemberships(operator.id)).toEqual([]);
    // Regular owners can't open someone else's organization.
    expect(await canOpenOrganization(first.owner.id, second.org.id)).toBe(false);
  });

  it("searches organizations by name, and finds nothing for an empty query", async () => {
    const { org } = await createTestOrg("l1-search-100%_match");
    expect(await searchOrganizations("")).toEqual([]);
    expect(await searchOrganizations("l1-search-100%_")).toEqual([expect.objectContaining({ id: org.id })]);
    expect(await searchOrganizations("l1-search-100%x")).toEqual([]);
  });
});
