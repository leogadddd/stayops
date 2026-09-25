import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireOwner, type MembershipContext } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PermissionDenied } from "@/components/app/permission-denied";
import { getAuditLogPage, listAuditEvents } from "@/server/audit/service";
import * as inventory from "@/server/inventory/service";
import { InventoryError } from "@/server/inventory/validation";
import SettingsPage from "@/app/(app)/settings/page";
import PropertiesPage from "@/app/(app)/properties/page";
import PropertyDetailPage from "@/app/(app)/properties/[propertyId]/page";
import UnitDetailPage from "@/app/(app)/properties/[propertyId]/units/[unitId]/page";
import AuditLogsPage from "@/app/(app)/audit-logs/page";
import EditOrganizationPage from "@/app/(app)/settings/organization/edit/page";
import EditPaymentInstructionsPage from "@/app/(app)/settings/payment-instructions/edit/page";
import NewStaffPage from "@/app/(app)/settings/staff/new/page";
import NewPropertyPage from "@/app/(app)/properties/new/page";
import EditPropertyPage from "@/app/(app)/properties/[propertyId]/edit/page";
import NewUnitPage from "@/app/(app)/properties/[propertyId]/units/new/page";
import EditUnitPage from "@/app/(app)/properties/[propertyId]/units/[unitId]/edit/page";
import NewUnitBlockPage from "@/app/(app)/properties/[propertyId]/units/[unitId]/blocks/new/page";
import EditChecklistPage from "@/app/(app)/properties/[propertyId]/units/[unitId]/checklist/edit/page";
import { OrgNameForm } from "@/app/(app)/settings/org-name-form";
import { PaymentInstructionsForm } from "@/app/(app)/settings/payment-instructions-form";
import { InviteStaffForm } from "@/app/(app)/settings/staff-forms";
import { PropertyForm } from "@/app/(app)/properties/property-form";
import { UnitCreateForm } from "@/app/(app)/properties/unit-create-form";
import { UnitEditForm } from "@/app/(app)/properties/[propertyId]/units/unit-edit-form";
import { BlockForms } from "@/app/(app)/properties/[propertyId]/units/block-forms";
import { ChecklistTemplateEditor } from "@/app/(app)/properties/[propertyId]/units/checklist-template-editor";

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), redirect: vi.fn() }));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useActionState: vi.fn(),
  useEffect: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  redirect: navigation.redirect,
  notFound: () => { throw new Error("Not found"); },
}));
vi.mock("@/lib/auth/session", () => ({ requireOwner: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { query: { organizations: { findFirst: vi.fn() } }, select: vi.fn() } }));
vi.mock("@/server/audit/service", () => ({ getAuditLogPage: vi.fn(), listAuditEvents: vi.fn() }));
vi.mock("@/server/inventory/service", () => ({
  listProperties: vi.fn(), listPropertyUnits: vi.fn(), getPropertyOrThrow: vi.fn(),
  getUnitOrThrow: vi.fn(), listUnitBlocks: vi.fn(),
}));
vi.mock("@/server/inventory/amenities", () => ({
  listAmenities: vi.fn(async () => []), listPropertyAmenities: vi.fn(async () => []), listUnitAmenities: vi.fn(async () => []),
}));
vi.mock("@/app/(app)/settings/actions", () => ({
  renameOrganization: vi.fn(), saveOrganizationProfile: vi.fn(), savePaymentInstructions: vi.fn(), inviteStaffAction: vi.fn(), removeStaffAction: vi.fn(),
}));
vi.mock("@/app/(app)/properties/actions", () => ({
  createPropertyAction: vi.fn(), updatePropertyAction: vi.fn(), createUnitAction: vi.fn(),
  updateUnitAction: vi.fn(), updateChecklistTemplateAction: vi.fn(),
  deletePropertyAction: vi.fn(), deleteUnitAction: vi.fn(),
}));
vi.mock("@/app/(app)/properties/[propertyId]/units/block-actions", () => ({
  addUnitBlockAction: vi.fn(), removeUnitBlockAction: vi.fn(),
}));

const owner: MembershipContext = {
  organizationId: "org-a", organizationName: "Test stays", organizationSlug: "test-stays", userId: "owner-a", role: "owner",
};
const property = {
  id: "property-a", organizationId: owner.organizationId, name: "Test property", address: "Private address",
  timezone: "Asia/Manila", checkInTime: "15:00", checkOutTime: "11:00", turnoverDurationMinutes: 120, houseRules: "Quiet after 10pm",
  imageUrl: null,
  createdAt: new Date("2026-09-01T00:00:00Z"), updatedAt: new Date("2026-09-01T00:00:00Z"),
  deletedAt: null,
};
const unit = {
  id: "unit-a", organizationId: owner.organizationId, propertyId: property.id, name: "Test unit",
  status: "active" as const, capacity: 2, bedrooms: 1, bathrooms: 1, defaultNightlyRateCents: 125_050,
  imageUrl: null,
  cleaningFeeCents: 30_000, securityDepositCents: null, checkInTime: "15:00", checkOutTime: "11:00", checklistTemplate: [{ label: "Clean room", required: true }],
  createdAt: new Date("2026-09-01T00:00:00Z"), updatedAt: new Date("2026-09-01T00:00:00Z"),
  deletedAt: null,
};
const propertyHref = `/properties/${property.id}`;
const unitHref = `${propertyHref}/units/${unit.id}`;
const propertyParams = () => ({ params: Promise.resolve({ propertyId: property.id }) });
const unitParams = () => ({ params: Promise.resolve({ propertyId: property.id, unitId: unit.id }) });

const propertyPages = [
  { name: "property edit", render: () => EditPropertyPage(propertyParams()), firstRead: inventory.getPropertyOrThrow },
  { name: "unit create", render: () => NewUnitPage(propertyParams()), firstRead: inventory.getPropertyOrThrow },
];
const unitPages = [
  { name: "unit edit", render: () => EditUnitPage(unitParams()), firstRead: inventory.getPropertyOrThrow },
  { name: "block create", render: () => NewUnitBlockPage(unitParams()), firstRead: inventory.getPropertyOrThrow },
  { name: "checklist edit", render: () => EditChecklistPage(unitParams()), firstRead: inventory.getPropertyOrThrow },
];
const newPages = [
  { name: "audit logs", render: () => AuditLogsPage(), firstRead: getAuditLogPage },
  { name: "organization edit", render: () => EditOrganizationPage(), firstRead: db.query.organizations.findFirst, hasPageHeading: false },
  { name: "payment instructions edit", render: () => EditPaymentInstructionsPage(), firstRead: db.query.organizations.findFirst },
  { name: "staff create", render: () => NewStaffPage(), firstRead: undefined },
  { name: "property create", render: () => NewPropertyPage(), firstRead: undefined },
  ...propertyPages, ...unitPages,
];
const reads = [db.query.organizations.findFirst, db.select, getAuditLogPage, listAuditEvents, ...Object.values(inventory)];

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(React.useActionState).mockReturnValue([{}, vi.fn(), false]);
  vi.mocked(requireOwner).mockResolvedValue(owner);
  vi.mocked(db.query.organizations.findFirst).mockResolvedValue({
    id: owner.organizationId, name: owner.organizationName, displayName: null, slug: owner.organizationSlug, defaultTimezone: "Asia/Manila",
    contactEmail: null, contactPhone: null, logoUrl: null, addressLine1: null, addressLine2: null,
    city: null, municipality: null, province: null, region: null, country: "Philippines", businessAddress: null, legalName: null, taxId: null,
    paymentInstructions: "Contact the owner for payment details", createdAt: new Date("2026-09-01T00:00:00Z"),
    updatedAt: new Date("2026-09-01T00:00:00Z"),
  });
  vi.mocked(db.select).mockReturnValue({
    from: () => ({ innerJoin: () => ({ where: async () => [{ membershipId: "member-a", name: "Team member", email: "staff@example.com", role: "staff" }] }) }),
  } as unknown as ReturnType<typeof db.select>);
  vi.mocked(inventory.listProperties).mockResolvedValue([property]);
  vi.mocked(inventory.listPropertyUnits).mockResolvedValue([unit]);
  vi.mocked(inventory.getPropertyOrThrow).mockResolvedValue(property);
  vi.mocked(inventory.getUnitOrThrow).mockResolvedValue(unit);
  vi.mocked(inventory.listUnitBlocks).mockResolvedValue([]);
  vi.mocked(getAuditLogPage).mockResolvedValue({ events: [], page: 1, pageSize: 25, total: 0 });
});

describe("dedicated owner route boundaries", () => {
  it.each(newPages)("denies direct non-owner access to $name before any reads", async ({ render }) => {
    vi.mocked(requireOwner).mockResolvedValue(null);
    const tree = await render();
    expect(tree.type).toBe(PermissionDenied);
    expect(requireOwner).toHaveBeenCalledOnce();
    for (const read of reads) expect(read).not.toHaveBeenCalled();
  });

  it.each(newPages)("renders $name after its own owner check", async (page) => {
    const { render, firstRead } = page;
    const hasPageHeading = !("hasPageHeading" in page) || page.hasPageHeading !== false;
    const tree = await render();
    expect(tree.type).not.toBe(PermissionDenied);
    expect(requireOwner).toHaveBeenCalledOnce();
    if (firstRead) {
      expect(firstRead).toHaveBeenCalledOnce();
      const ownerCheckOrder = vi.mocked(requireOwner).mock.invocationCallOrder[0];
      expect(ownerCheckOrder).toBeDefined();
      expect(vi.mocked(firstRead).mock.invocationCallOrder[0]).toBeGreaterThan(ownerCheckOrder ?? Infinity);
    }
    const html = renderToStaticMarkup(tree);
    if (hasPageHeading) expect(html).toContain("<h1");
    else expect(html).not.toContain("<h1");
  });

  it.each([...propertyPages, ...unitPages])("scopes $name property reads to the trusted tenant", async ({ render }) => {
    await render();
    expect(inventory.getPropertyOrThrow).toHaveBeenCalledExactlyOnceWith(owner.organizationId, property.id);
  });

  it.each([...propertyPages, ...unitPages])("rejects inaccessible properties for $name", async ({ render }) => {
    vi.mocked(inventory.getPropertyOrThrow).mockRejectedValue(new InventoryError("Property not found."));
    await expect(render()).rejects.toThrow("Not found");
    expect(inventory.getUnitOrThrow).not.toHaveBeenCalled();
  });

  it.each(unitPages)("scopes $name unit reads and rejects wrong-property units", async ({ render }) => {
    vi.mocked(inventory.getUnitOrThrow).mockResolvedValue({ ...unit, propertyId: "other-property" });
    await expect(render()).rejects.toThrow("Not found");
    expect(inventory.getUnitOrThrow).toHaveBeenCalledExactlyOnceWith(owner.organizationId, unit.id);
    expect(inventory.listUnitBlocks).not.toHaveBeenCalled();
  });

  it.each(unitPages)("rejects inaccessible units for $name", async ({ render }) => {
    vi.mocked(inventory.getUnitOrThrow).mockRejectedValue(new InventoryError("Unit not found."));
    await expect(render()).rejects.toThrow("Not found");
  });

  it.each(propertyPages)("does not hide unexpected read failures on $name", async ({ render }) => {
    vi.mocked(inventory.getPropertyOrThrow).mockRejectedValue(new Error("Database unavailable"));
    await expect(render()).rejects.toThrow("Database unavailable");
  });
});

describe("read-only summaries and reusable tables", () => {
  it("redirects the settings entry point to General", async () => {
    await SettingsPage();
    expect(navigation.redirect).toHaveBeenCalledWith("/settings/general");
    expect(listAuditEvents).not.toHaveBeenCalled();
  });

  it("lists properties in a shared table and links to a separate create route", async () => {
    const html = renderToStaticMarkup(await PropertiesPage());
    expect(html).toContain('data-slot="table"');
    expect(html).toContain('href="/properties/new"');
    expect(html).toContain(`href="${propertyHref}"`);
    expect(html).not.toContain("<form");
  });

  it("shows property details and a units table without embedded forms", async () => {
    const html = renderToStaticMarkup(await PropertyDetailPage(propertyParams()));
    expect(html).toContain("Private address");
    expect(html).toContain("Quiet after 10pm");
    expect(html).toContain('data-slot="table"');
    for (const href of [`${propertyHref}/edit`, `${propertyHref}/units/new`, unitHref]) expect(html).toContain(`href="${href}"`);
    expect(html).not.toContain("<form");
  });

  it("shows unit and checklist summaries, a blocks table and dedicated editor links", async () => {
    const html = renderToStaticMarkup(await UnitDetailPage(unitParams()));
    expect(html).toContain("Clean room");
    expect(html).toContain('data-slot="table"');
    for (const href of [`${unitHref}/edit`, `${unitHref}/blocks/new`, `${unitHref}/checklist/edit`]) expect(html).toContain(`href="${href}"`);
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<details");
    expect(inventory.listUnitBlocks).toHaveBeenCalledWith(owner.organizationId, unit.id, expect.any(String));
  });

  it("renders audit activity, target, details and actor context", async () => {
    vi.mocked(getAuditLogPage).mockResolvedValue({ events: [
      {
        id: "audit-a", action: "guest_link.created", entity: "access_token", entityId: "token-a",
        metadata: { reservationId: "reservation-a" }, actorUserId: "owner-a", actorName: "Owner Example",
        createdAt: new Date("2026-09-01T00:00:00Z"),
      },
      {
        id: "audit-b", action: "property.deleted", entity: "property", entityId: "property-a",
        metadata: { name: "Beach House", deletedUnitCount: 2, deletedUnitNames: ["Suite A", "Suite B"] },
        actorUserId: null, actorName: null, createdAt: new Date("2026-09-01T00:00:00Z"),
      },
      {
        id: "audit-c", action: "payment_proof.submitted", entity: "payment_proof", entityId: "proof-a",
        metadata: { reservationId: "reservation-a" }, actorUserId: null, actorName: null,
        createdAt: new Date("2026-09-01T00:00:00Z"),
      },
    ], page: 1, pageSize: 25, total: 3 });
    const html = renderToStaticMarkup(await AuditLogsPage());
    expect(getAuditLogPage).toHaveBeenCalledExactlyOnceWith(owner.organizationId, { action: undefined, actor: undefined, startDate: undefined, endDate: undefined, page: 1 });
    for (const label of [
      "Time", "Activity", "Target", "Actor", "Guest link created", "Owner Example",
      "Property deleted", "Beach House", "2 units archived", "Suite A, Suite B", "System", "Guest portal",
    ]) expect(html).toContain(label);
    expect(html).toContain('dateTime="2026-09-01T00:00:00.000Z"');
    expect(html).toContain('data-slot="table"');
  });
});

const editors = [
  { name: "organization", render: () => React.createElement(OrgNameForm, { defaultName: owner.organizationName }), destination: undefined },
  { name: "payment instructions", render: () => React.createElement(PaymentInstructionsForm, { defaultValue: "" }), destination: undefined },
  { name: "staff", render: () => React.createElement(InviteStaffForm), destination: "/settings" },
  { name: "new property", render: () => React.createElement(PropertyForm), destination: "/properties" },
  { name: "edit property", render: () => React.createElement(PropertyForm, { propertyId: property.id }), destination: propertyHref },
  { name: "new unit", render: () => React.createElement(UnitCreateForm, { propertyId: property.id }), destination: propertyHref },
  { name: "edit unit", render: () => React.createElement(UnitEditForm, { propertyId: property.id, unitId: unit.id, values: { name: unit.name, capacity: 2, bedrooms: 1, bathrooms: 1, nightlyRate: "1250.50", cleaningFee: "300", securityDeposit: "", checkInTime: "15:00", checkOutTime: "11:00", status: "active" } }), destination: unitHref },
  { name: "block", render: () => React.createElement(BlockForms, { propertyId: property.id, unitId: unit.id }), destination: unitHref },
  { name: "checklist", render: () => React.createElement(ChecklistTemplateEditor, { propertyId: property.id, unitId: unit.id, items: unit.checklistTemplate }), destination: unitHref },
];

function flushNavigationEffects() {
  for (const [effect] of vi.mocked(React.useEffect).mock.calls) effect();
}

describe("editor save navigation", () => {
  it.each(editors)("handles a successful $name save", ({ render, destination }) => {
    vi.mocked(React.useActionState).mockReturnValue([{ success: true }, vi.fn(), false]);
    renderToStaticMarkup(render());
    flushNavigationEffects();
    if (destination) expect(navigation.push).toHaveBeenCalledExactlyOnceWith(destination);
    else expect(navigation.push).not.toHaveBeenCalled();
    expect(navigation.refresh).toHaveBeenCalledOnce();
  });

  it.each(editors)("retains $name form errors without navigating", ({ render }) => {
    vi.mocked(React.useActionState).mockReturnValue([{ error: "Check the submitted details." }, vi.fn(), false]);
    const html = renderToStaticMarkup(render());
    flushNavigationEffects();
    expect(html).toContain("Check the submitted details.");
    expect(html).toContain("<form");
    expect(navigation.push).not.toHaveBeenCalled();
    expect(navigation.refresh).not.toHaveBeenCalled();
  });
});
