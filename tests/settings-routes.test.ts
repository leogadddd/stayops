import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireOwner, type MembershipContext } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PermissionDenied } from "@/components/app/permission-denied";
import { listAuditEvents } from "@/server/audit/service";
import * as inventory from "@/server/inventory/service";
import { InventoryError } from "@/server/inventory/validation";
import SettingsPage from "@/app/(app)/settings/page";
import PropertiesPage from "@/app/(app)/settings/properties/page";
import PropertyDetailPage from "@/app/(app)/settings/properties/[propertyId]/page";
import UnitDetailPage from "@/app/(app)/settings/properties/[propertyId]/units/[unitId]/page";
import AuditLogsPage from "@/app/(app)/audit-logs/page";
import EditOrganizationPage from "@/app/(app)/settings/organization/edit/page";
import EditPaymentInstructionsPage from "@/app/(app)/settings/payment-instructions/edit/page";
import NewStaffPage from "@/app/(app)/settings/staff/new/page";
import NewPropertyPage from "@/app/(app)/settings/properties/new/page";
import EditPropertyPage from "@/app/(app)/settings/properties/[propertyId]/edit/page";
import NewUnitPage from "@/app/(app)/settings/properties/[propertyId]/units/new/page";
import EditUnitPage from "@/app/(app)/settings/properties/[propertyId]/units/[unitId]/edit/page";
import NewUnitBlockPage from "@/app/(app)/settings/properties/[propertyId]/units/[unitId]/blocks/new/page";
import EditChecklistPage from "@/app/(app)/settings/properties/[propertyId]/units/[unitId]/checklist/edit/page";
import { OrgNameForm } from "@/app/(app)/settings/org-name-form";
import { PaymentInstructionsForm } from "@/app/(app)/settings/payment-instructions-form";
import { InviteStaffForm } from "@/app/(app)/settings/staff-forms";
import { PropertyForm } from "@/app/(app)/settings/properties/property-form";
import { UnitCreateForm } from "@/app/(app)/settings/properties/unit-create-form";
import { UnitEditForm } from "@/app/(app)/settings/properties/[propertyId]/units/unit-edit-form";
import { BlockForms } from "@/app/(app)/settings/properties/[propertyId]/units/block-forms";
import { ChecklistTemplateEditor } from "@/app/(app)/settings/properties/[propertyId]/units/checklist-template-editor";

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useActionState: vi.fn(),
  useEffect: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  notFound: () => { throw new Error("Not found"); },
}));
vi.mock("@/lib/auth/session", () => ({ requireOwner: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { query: { organizations: { findFirst: vi.fn() } }, select: vi.fn() } }));
vi.mock("@/server/audit/service", () => ({ listAuditEvents: vi.fn() }));
vi.mock("@/server/inventory/service", () => ({
  listProperties: vi.fn(), listPropertyUnits: vi.fn(), getPropertyOrThrow: vi.fn(),
  getUnitOrThrow: vi.fn(), listUnitBlocks: vi.fn(),
}));
vi.mock("@/app/(app)/settings/actions", () => ({
  renameOrganization: vi.fn(), savePaymentInstructions: vi.fn(), inviteStaffAction: vi.fn(), removeStaffAction: vi.fn(),
}));
vi.mock("@/app/(app)/settings/properties/actions", () => ({
  createPropertyAction: vi.fn(), updatePropertyAction: vi.fn(), createUnitAction: vi.fn(),
  updateUnitAction: vi.fn(), updateChecklistTemplateAction: vi.fn(),
}));
vi.mock("@/app/(app)/settings/properties/[propertyId]/units/block-actions", () => ({
  addUnitBlockAction: vi.fn(), removeUnitBlockAction: vi.fn(),
}));

const owner: MembershipContext = {
  organizationId: "org-a", organizationName: "Test stays", organizationSlug: "test-stays", userId: "owner-a", role: "owner",
};
const property = {
  id: "property-a", organizationId: owner.organizationId, name: "Test property", address: "Private address",
  timezone: "Asia/Manila", checkInTime: "15:00", checkOutTime: "11:00", houseRules: "Quiet after 10pm",
  createdAt: new Date("2026-09-01T00:00:00Z"), updatedAt: new Date("2026-09-01T00:00:00Z"),
};
const unit = {
  id: "unit-a", organizationId: owner.organizationId, propertyId: property.id, name: "Test unit",
  status: "active" as const, capacity: 2, bedrooms: 1, bathrooms: 1, defaultNightlyRateCents: 125_050,
  cleaningFeeCents: 30_000, securityDepositCents: null, checklistTemplate: [{ label: "Clean room", required: true }],
  createdAt: new Date("2026-09-01T00:00:00Z"), updatedAt: new Date("2026-09-01T00:00:00Z"),
};
const propertyHref = `/settings/properties/${property.id}`;
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
  { name: "audit logs", render: () => AuditLogsPage(), firstRead: listAuditEvents },
  { name: "organization edit", render: () => EditOrganizationPage(), firstRead: db.query.organizations.findFirst },
  { name: "payment instructions edit", render: () => EditPaymentInstructionsPage(), firstRead: db.query.organizations.findFirst },
  { name: "staff create", render: () => NewStaffPage(), firstRead: undefined },
  { name: "property create", render: () => NewPropertyPage(), firstRead: undefined },
  ...propertyPages, ...unitPages,
];
const reads = [db.query.organizations.findFirst, db.select, listAuditEvents, ...Object.values(inventory)];

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(React.useActionState).mockReturnValue([{}, vi.fn(), false]);
  vi.mocked(requireOwner).mockResolvedValue(owner);
  vi.mocked(db.query.organizations.findFirst).mockResolvedValue({
    id: owner.organizationId, name: owner.organizationName, slug: owner.organizationSlug,
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
  vi.mocked(listAuditEvents).mockResolvedValue([]);
});

describe("dedicated owner route boundaries", () => {
  it.each(newPages)("denies direct non-owner access to $name before any reads", async ({ render }) => {
    vi.mocked(requireOwner).mockResolvedValue(null);
    const tree = await render();
    expect(tree.type).toBe(PermissionDenied);
    expect(requireOwner).toHaveBeenCalledOnce();
    for (const read of reads) expect(read).not.toHaveBeenCalled();
  });

  it.each(newPages)("renders $name after its own owner check", async ({ render, firstRead }) => {
    const tree = await render();
    expect(tree.type).not.toBe(PermissionDenied);
    expect(requireOwner).toHaveBeenCalledOnce();
    if (firstRead) {
      expect(firstRead).toHaveBeenCalledOnce();
      const ownerCheckOrder = vi.mocked(requireOwner).mock.invocationCallOrder[0];
      expect(ownerCheckOrder).toBeDefined();
      expect(vi.mocked(firstRead).mock.invocationCallOrder[0]).toBeGreaterThan(ownerCheckOrder ?? Infinity);
    }
    expect(renderToStaticMarkup(tree)).toContain("<h1");
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
  it("keeps settings forms and the audit query off the settings overview", async () => {
    const html = renderToStaticMarkup(await SettingsPage());
    expect(html).not.toContain("<form");
    expect(html).toContain('data-slot="table"');
    expect(html).toContain("Contact the owner for payment details");
    for (const href of ["/settings/organization/edit", "/settings/payment-instructions/edit", "/settings/staff/new", "/audit-logs"]) expect(html).toContain(`href="${href}"`);
    expect(listAuditEvents).not.toHaveBeenCalled();
    expect(html).toContain("Remove Team member");
  });

  it("lists properties in a shared table and links to a separate create route", async () => {
    const html = renderToStaticMarkup(await PropertiesPage());
    expect(html).toContain('data-slot="table"');
    expect(html).toContain('href="/settings/properties/new"');
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

  it("renders audit time/action/actor columns and the guest-link creation label", async () => {
    vi.mocked(listAuditEvents).mockResolvedValue([
      { id: "audit-a", action: "guest_link.created", actorName: "Owner Example", createdAt: new Date("2026-09-01T00:00:00Z") },
      { id: "audit-b", action: "future.action", actorName: null, createdAt: new Date("2026-09-01T00:00:00Z") },
    ]);
    const html = renderToStaticMarkup(await AuditLogsPage());
    expect(listAuditEvents).toHaveBeenCalledExactlyOnceWith(owner.organizationId, 50);
    for (const label of ["Time", "Action", "Actor", "Guest link created", "Owner Example", "Not recorded", "future.action"]) expect(html).toContain(label);
    expect(html).toContain('dateTime="2026-09-01T00:00:00.000Z"');
    expect(html).toContain('data-slot="table"');
  });
});

const editors = [
  { name: "organization", render: () => React.createElement(OrgNameForm, { defaultName: owner.organizationName }), destination: "/settings" },
  { name: "payment instructions", render: () => React.createElement(PaymentInstructionsForm, { defaultValue: "" }), destination: "/settings" },
  { name: "staff", render: () => React.createElement(InviteStaffForm), destination: "/settings" },
  { name: "new property", render: () => React.createElement(PropertyForm), destination: "/settings/properties" },
  { name: "edit property", render: () => React.createElement(PropertyForm, { propertyId: property.id }), destination: propertyHref },
  { name: "new unit", render: () => React.createElement(UnitCreateForm, { propertyId: property.id }), destination: propertyHref },
  { name: "edit unit", render: () => React.createElement(UnitEditForm, { propertyId: property.id, unitId: unit.id, values: { name: unit.name, capacity: 2, bedrooms: 1, bathrooms: 1, nightlyRate: "1250.50", cleaningFee: "300", securityDeposit: "", status: "active" } }), destination: unitHref },
  { name: "block", render: () => React.createElement(BlockForms, { propertyId: property.id, unitId: unit.id }), destination: unitHref },
  { name: "checklist", render: () => React.createElement(ChecklistTemplateEditor, { propertyId: property.id, unitId: unit.id, items: unit.checklistTemplate }), destination: unitHref },
];

function flushNavigationEffects() {
  for (const [effect] of vi.mocked(React.useEffect).mock.calls) effect();
}

describe("editor save navigation", () => {
  it.each(editors)("navigates after a successful $name save", ({ render, destination }) => {
    vi.mocked(React.useActionState).mockReturnValue([{ success: true }, vi.fn(), false]);
    renderToStaticMarkup(render());
    flushNavigationEffects();
    expect(navigation.push).toHaveBeenCalledExactlyOnceWith(destination);
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
