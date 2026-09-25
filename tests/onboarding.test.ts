import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireMembership, requireUser, type MembershipContext } from "@/lib/auth/session";
import * as inventory from "@/server/inventory/service";
import * as orgs from "@/server/orgs/service";
import {
  saveFirstPropertyAction,
  saveFirstUnitAction,
  saveOrganizationAction,
} from "@/app/onboarding/actions";
import {
  getOnboardingState,
  guardOnboardingStep,
  nextOnboardingPath,
  type OnboardingState,
} from "@/app/onboarding/state";

vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/session")>(),
  requireUser: vi.fn(),
  requireMembership: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: {} }));
vi.mock("@/lib/db", () => ({
  db: { query: { organizations: { findFirst: vi.fn(async () => ({ defaultTimezone: "Asia/Singapore" })) } } },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/orgs/service", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/server/orgs/service")>(),
  createOrganization: vi.fn(),
  updateOrganizationName: vi.fn(),
}));
vi.mock("@/server/inventory/service", () => ({
  createProperty: vi.fn(), updateProperty: vi.fn(),
  createUnit: vi.fn(), updateUnit: vi.fn(),
  listProperties: vi.fn(), listOrgUnits: vi.fn(),
}));
vi.mock("@/app/onboarding/state", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/app/onboarding/state")>(),
  getOnboardingState: vi.fn(),
}));

const owner: MembershipContext = {
  organizationId: "org-1", organizationName: "Test stays",
  organizationSlug: "test-stays", userId: "user-1", role: "owner",
};
const membership = {
  organizationId: "org-1", organizationName: "Test stays",
  organizationSlug: "test-stays", role: "owner" as const,
};
const property = {
  id: "property-1", name: "Makati Suites", address: null, timezone: "Asia/Manila",
  checkInTime: "14:00", checkOutTime: "12:00", turnoverDurationMinutes: 90, houseRules: "No smoking",
} as NonNullable<OnboardingState["property"]>;
const unit = {
  id: "unit-1", name: "Unit 12B", capacity: 4, bedrooms: 2, bathrooms: 1.5,
  defaultNightlyRateCents: 550000, cleaningFeeCents: 50000, securityDepositCents: null,
  checkInTime: "14:00", checkOutTime: "12:00", status: "active",
} as NonNullable<OnboardingState["unit"]>;
const empty: OnboardingState = { membership: null, property: null, unit: null };

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function withState(state: Partial<OnboardingState>) {
  vi.mocked(getOnboardingState).mockResolvedValue({ ...empty, ...state });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireUser).mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof requireUser>>);
  vi.mocked(requireMembership).mockResolvedValue(owner);
  withState({});
});

describe("saveOrganizationAction", () => {
  it("creates the organization on the first visit", async () => {
    expect(await saveOrganizationAction({}, form({ name: " Test stays " }))).toEqual({ success: true });
    expect(orgs.createOrganization).toHaveBeenCalledWith({ name: "Test stays", ownerUserId: "user-1" });
  });

  it("renames it when the owner comes back and changes the name", async () => {
    withState({ membership });
    await saveOrganizationAction({}, form({ name: "Dela Cruz Stays" }));
    expect(orgs.createOrganization).not.toHaveBeenCalled();
    expect(orgs.updateOrganizationName).toHaveBeenCalledWith({
      organizationId: "org-1", actorUserId: "user-1", name: "Dela Cruz Stays",
    });
  });

  it("does nothing when the name is unchanged", async () => {
    withState({ membership });
    expect(await saveOrganizationAction({}, form({ name: "Test stays" }))).toEqual({ success: true });
    expect(orgs.createOrganization).not.toHaveBeenCalled();
    expect(orgs.updateOrganizationName).not.toHaveBeenCalled();
  });

  it("shows the service's validation message", async () => {
    vi.mocked(orgs.createOrganization).mockRejectedValue(
      new orgs.OrgError("Organization name needs at least 2 characters.", "name"),
    );
    const state = await saveOrganizationAction({}, form({ name: "x" }));
    expect(state.error).toMatch(/at least 2 characters/);
  });
});

describe("saveFirstPropertyAction", () => {
  it("creates the property with the organization's timezone", async () => {
    withState({ membership });
    expect(await saveFirstPropertyAction({}, form({ name: "Makati Suites", address: "Ayala Ave" }))).toEqual({ success: true });
    expect(inventory.createProperty).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "org-1",
      data: expect.objectContaining({ name: "Makati Suites", address: "Ayala Ave", timezone: "Asia/Singapore" }),
    }));
  });

  it("edits the existing property and keeps its other settings", async () => {
    withState({ membership, property });
    await saveFirstPropertyAction({}, form({ name: "BGC Lofts", address: "5th Ave" }));
    expect(inventory.createProperty).not.toHaveBeenCalled();
    expect(inventory.updateProperty).toHaveBeenCalledWith(expect.objectContaining({
      propertyId: "property-1",
      data: {
        name: "BGC Lofts", address: "5th Ave", timezone: "Asia/Manila",
        checkInTime: "14:00", checkOutTime: "12:00", turnoverDurationMinutes: 90, houseRules: "No smoking",
      },
    }));
  });

  it("rejects staff", async () => {
    vi.mocked(requireMembership).mockResolvedValue({ ...owner, role: "staff" });
    expect((await saveFirstPropertyAction({}, form({ name: "Makati Suites" }))).error).toBeTruthy();
    expect(inventory.createProperty).not.toHaveBeenCalled();
  });
});

describe("saveFirstUnitAction", () => {
  it("creates an active unit from just its name", async () => {
    withState({ membership, property });
    expect(await saveFirstUnitAction({}, form({ name: "Unit 12B" }))).toEqual({ success: true });
    expect(inventory.createUnit).toHaveBeenCalledWith(expect.objectContaining({
      propertyId: "property-1",
      data: expect.objectContaining({
        name: "Unit 12B", status: "active", capacity: 2,
        checkInTime: "14:00", checkOutTime: "12:00",
      }),
    }));
  });

  it("renames the existing unit and keeps its other settings", async () => {
    withState({ membership, property, unit });
    await saveFirstUnitAction({}, form({ name: "Unit 15A" }));
    expect(inventory.createUnit).not.toHaveBeenCalled();
    expect(inventory.updateUnit).toHaveBeenCalledWith(expect.objectContaining({
      unitId: "unit-1",
      data: expect.objectContaining({
        name: "Unit 15A", capacity: 4, bedrooms: 2, bathrooms: 1.5,
        defaultNightlyRateCents: 550000, cleaningFeeCents: 50000, status: "active",
      }),
    }));
  });

  it("needs a property first", async () => {
    withState({ membership });
    expect((await saveFirstUnitAction({}, form({ name: "Unit 12B" }))).error).toBeTruthy();
    expect(inventory.createUnit).not.toHaveBeenCalled();
  });
});

describe("onboarding routing", () => {
  it("finds the first missing step", () => {
    expect(nextOnboardingPath(empty)).toBe("/onboarding/organization");
    expect(nextOnboardingPath({ ...empty, membership })).toBe("/onboarding/property");
    expect(nextOnboardingPath({ ...empty, membership, property })).toBe("/onboarding/unit");
    expect(nextOnboardingPath({ membership, property, unit })).toBe("/onboarding/welcome");
  });

  it("lets owners revisit finished steps but not jump ahead", () => {
    const done = { membership, property, unit };
    expect(guardOnboardingStep(done, "organization")).toBeNull();
    expect(guardOnboardingStep(done, "property")).toBeNull();
    expect(guardOnboardingStep(done, "unit")).toBeNull();
    expect(guardOnboardingStep(empty, "property")).toBe("/onboarding/organization");
    expect(guardOnboardingStep({ ...empty, membership }, "unit")).toBe("/onboarding/property");
  });

  it("sends staff to the dashboard", () => {
    const staff = { ...empty, membership: { ...membership, role: "staff" as const } };
    expect(nextOnboardingPath(staff)).toBe("/dashboard");
    expect(guardOnboardingStep(staff, "organization")).toBe("/dashboard");
  });
});
