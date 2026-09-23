import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireMembership, requireOwner, type MembershipContext } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PermissionDenied } from "@/components/app/permission-denied";
import { listAuditEvents } from "@/server/audit/service";
import * as inventory from "@/server/inventory/service";
import { listExpenses } from "@/server/expenses/service";
import { getReport } from "@/server/reports/service";
import { getReservationDetail, listGuests } from "@/server/reservations/service";
import NewReservationPage from "@/app/(app)/reservations/new/page";
import { ReservationForm } from "@/app/(app)/reservations/new/reservation-form";
import { expireStaleHolds } from "@/server/reservations/holds";
import { getReservationLedger } from "@/server/payments/service";
import { getTaskForReservation, listOpenDamageReports } from "@/server/operations/service";
import SettingsPage from "@/app/(app)/settings/page";
import SettingsLayout from "@/app/(app)/settings/layout";
import PropertiesPage from "@/app/(app)/settings/properties/page";
import PropertyDetailPage from "@/app/(app)/settings/properties/[propertyId]/page";
import UnitDetailPage from "@/app/(app)/settings/properties/[propertyId]/units/[unitId]/page";
import ReportsPage from "@/app/(app)/reports/page";
import ExpensesPage from "@/app/(app)/expenses/page";
import ReservationDetailPage from "@/app/(app)/reservations/[id]/page";
import { PaymentsCard } from "@/app/(app)/reservations/[id]/payments-card";
import { CheckInForm } from "@/app/(app)/reservations/[id]/check-in-form";
import { CheckOutForm } from "@/app/(app)/reservations/[id]/check-out-form";
import { DamageReportForm } from "@/app/(app)/tasks/damage-report-form";
import { RecordPaymentForm } from "@/app/(app)/reservations/[id]/record-payment-form";
import { RecordRefundForm } from "@/app/(app)/reservations/[id]/record-refund-form";
import { AddDeductionForm } from "@/app/(app)/reservations/[id]/add-deduction-form";
import { GuestLinkCard } from "@/app/(app)/reservations/[id]/guest-link-card";

vi.mock("@/lib/auth/session", () => ({
  requireMembership: vi.fn(),
  requireOwner: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => { throw new Error("Not found"); }),
  redirect: vi.fn(() => { throw new Error("Unexpected redirect"); }),
}));
vi.mock("@/lib/db", () => ({
  db: {
    query: { organizations: { findFirst: vi.fn() } },
    select: vi.fn(),
  },
}));
vi.mock("@/server/audit/service", () => ({ listAuditEvents: vi.fn() }));
vi.mock("@/server/inventory/service", () => ({
  listProperties: vi.fn(),
  listPropertyUnits: vi.fn(),
  getPropertyOrThrow: vi.fn(),
  getUnitOrThrow: vi.fn(),
  listUnitBlocks: vi.fn(),
  listOrgUnits: vi.fn(),
}));
vi.mock("@/server/expenses/service", () => ({ listExpenses: vi.fn() }));
vi.mock("@/server/reports/service", () => ({
  getReport: vi.fn(),
  ReportError: class extends Error {},
}));
vi.mock("@/server/reservations/service", () => ({
  getReservationDetail: vi.fn(),
  listGuests: vi.fn(),
  isLiveHold: vi.fn(() => false),
  ReservationError: class extends Error {},
}));
vi.mock("@/server/reservations/holds", () => ({ expireStaleHolds: vi.fn() }));
vi.mock("@/server/payments/service", () => ({ getReservationLedger: vi.fn() }));
vi.mock("@/server/operations/service", () => ({
  getTaskForReservation: vi.fn(),
  listOpenDamageReports: vi.fn(),
}));

const owner: MembershipContext = {
  organizationId: "org-a",
  organizationName: "Test stays",
  organizationSlug: "test-stays",
  userId: "user-a",
  role: "owner",
};
const staff: MembershipContext = { ...owner, role: "staff" };

// Supply React for Next TSX compiled with the classic JSX runtime in this suite.
beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireMembership).mockResolvedValue(staff);
  vi.mocked(requireOwner).mockResolvedValue(null);
});

const protectedReads = [
  db.query.organizations.findFirst,
  db.select,
  listAuditEvents,
  inventory.listProperties,
  inventory.listPropertyUnits,
  inventory.getPropertyOrThrow,
  inventory.getUnitOrThrow,
  inventory.listUnitBlocks,
  inventory.listOrgUnits,
  listExpenses,
  getReport,
];

const ownerPages = [
  { name: "settings", render: () => SettingsPage(), firstRead: db.query.organizations.findFirst },
  { name: "properties", render: () => PropertiesPage(), firstRead: inventory.listProperties },
  {
    name: "property detail",
    render: () => PropertyDetailPage({ params: Promise.resolve({ propertyId: "property-a" }) }),
    firstRead: inventory.getPropertyOrThrow,
  },
  {
    name: "unit detail",
    render: () => UnitDetailPage({ params: Promise.resolve({ propertyId: "property-a", unitId: "unit-a" }) }),
    firstRead: inventory.getPropertyOrThrow,
  },
  {
    name: "reports",
    render: () => ReportsPage({ searchParams: Promise.resolve({}) }),
    firstRead: inventory.listProperties,
  },
  {
    name: "expenses",
    render: () => ExpensesPage({ searchParams: Promise.resolve({}) }),
    firstRead: inventory.listProperties,
  },
];

describe("independent owner page boundaries", () => {
  it.each(ownerPages)("denies direct staff rendering of $name before protected reads", async ({ render }) => {
    const tree = await render();
    expect(tree.type).toBe(PermissionDenied);
    expect(renderToStaticMarkup(tree)).toContain("Owner access only");
    expect(requireOwner).toHaveBeenCalledOnce();
    expect(requireMembership).not.toHaveBeenCalled();
    for (const read of protectedReads) expect(read).not.toHaveBeenCalled();
  });

  it.each(ownerPages)("allows owners through the $name boundary", async ({ render, firstRead }) => {
    vi.mocked(requireOwner).mockResolvedValue(owner);
    vi.mocked(db.query.organizations.findFirst).mockResolvedValue(undefined);
    vi.mocked(db.select).mockReturnValue({
      from: () => ({ innerJoin: () => ({ where: async () => [] }) }),
    } as unknown as ReturnType<typeof db.select>);
    vi.mocked(listAuditEvents).mockResolvedValue([]);
    vi.mocked(inventory.listProperties).mockResolvedValue([]);
    vi.mocked(inventory.listPropertyUnits).mockResolvedValue([]);
    vi.mocked(inventory.listOrgUnits).mockResolvedValue([]);
    vi.mocked(inventory.listUnitBlocks).mockResolvedValue([]);
    vi.mocked(listExpenses).mockResolvedValue([]);
    vi.mocked(inventory.getPropertyOrThrow).mockResolvedValue({
      id: "property-a", name: "Test property", timezone: "Asia/Manila",
      checkInTime: "15:00", checkOutTime: "11:00",
    } as Awaited<ReturnType<typeof inventory.getPropertyOrThrow>>);
    vi.mocked(inventory.getUnitOrThrow).mockResolvedValue({
      id: "unit-a", organizationId: owner.organizationId, propertyId: "property-a",
      name: "Test unit", status: "active", capacity: 2, bedrooms: 1, bathrooms: 1,
      defaultNightlyRateCents: 100_000, cleaningFeeCents: null,
      securityDepositCents: null, checklistTemplate: [],
      createdAt: new Date("2026-09-01T00:00:00Z"),
      updatedAt: new Date("2026-09-01T00:00:00Z"),
    });
    vi.mocked(getReport).mockRejectedValue(new Error("Report unavailable"));

    const tree = await render();
    expect(tree.type).not.toBe(PermissionDenied);
    expect(requireOwner).toHaveBeenCalledOnce();
    expect(firstRead).toHaveBeenCalledOnce();
    if (firstRead !== db.query.organizations.findFirst) {
      expect(vi.mocked(firstRead).mock.calls[0]?.[0]).toBe(owner.organizationId);
    }
  });

  it("retains the settings layout guard in addition to the page guards", async () => {
    const tree = await SettingsLayout({ children: "Protected settings content" });
    expect(tree.type).toBe(PermissionDenied);
    expect(renderToStaticMarkup(tree)).not.toContain("Protected settings content");
    for (const read of protectedReads) expect(read).not.toHaveBeenCalled();

    vi.mocked(requireOwner).mockResolvedValue(owner);
    expect(renderToStaticMarkup(await SettingsLayout({ children: "Owner settings" })))
      .toContain("Owner settings");
  });
});

// Inspect props as well as markup to catch financial data leaked to client components.
function elements(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as React.ReactNode)];
}

function reservationFixture(status: "confirmed" | "checked_in" | "checked_out") {
  return {
    reservation: {
      id: "reservation-a", status, checkInDate: "2026-09-01",
      checkOutDate: "2026-09-03", guestCount: 2, expiresAt: null,
      confirmReason: null, cancelReason: null,
    },
    guest: { name: "Guest Example", email: "guest@example.com", phone: null, notes: "Arrives late" },
    unit: { id: "unit-a", name: "Operational unit" },
    property: { name: "Operational property" },
    charges: [
      { id: "charge-a", type: "accommodation", description: "Private negotiated rate", quantity: 2, unitAmountCents: 765_432, amountCents: 1_530_864 },
      { id: "charge-b", type: "security_deposit", description: "Private deposit", quantity: 1, unitAmountCents: 123_456, amountCents: 123_456 },
    ],
    transitions: [{ id: "transition-a", fromStatus: null, toStatus: "confirmed", note: "Booking created", createdAt: new Date("2026-08-01T00:00:00Z") }],
    activeToken: null,
  } as Awaited<ReturnType<typeof getReservationDetail>>;
}

describe("new reservation financial boundary", () => {
  it("does not send prices or confirmed-booking access to staff", async () => {
    vi.mocked(inventory.listOrgUnits).mockResolvedValue([{
      id: "unit-a", propertyId: "property-a", name: "Test unit", status: "active",
      capacity: 2, defaultNightlyRateCents: 765_432, cleaningFeeCents: 12_345,
      securityDepositCents: 123_456,
    }] as Awaited<ReturnType<typeof inventory.listOrgUnits>>);
    vi.mocked(inventory.listProperties).mockResolvedValue([]);
    vi.mocked(listGuests).mockResolvedValue([]);
    const tree = await NewReservationPage({ searchParams: Promise.resolve({}) });
    const form = elements(tree).find((node) => node.type === ReservationForm);
    expect(form?.props.isOwner).toBe(false);
    expect(form?.props.units).toEqual([{
      id: "unit-a", label: "Test unit", capacity: 2,
      nightlyRateCents: null, cleaningFeeCents: null, securityDepositCents: null,
    }]);
  });
});

describe("reservation financial boundary", () => {
  beforeEach(() => {
    vi.mocked(listOpenDamageReports).mockResolvedValue([]);
    vi.mocked(getTaskForReservation).mockResolvedValue({
      id: "turnover-a", doneItems: 1, totalItems: 3,
    } as Awaited<ReturnType<typeof getTaskForReservation>>);
    vi.mocked(getReservationLedger).mockResolvedValue({
      balances: { bookingBalanceCents: 654_321 },
      payments: [{ reference: "private-payment-reference" }],
      refunds: [], deductions: [], proofs: [],
    } as unknown as Awaited<ReturnType<typeof getReservationLedger>>);
  });

  it.each(["confirmed", "checked_in", "checked_out"] as const)(
    "keeps %s staff operations while excluding financial markup and props",
    async (status) => {
      vi.mocked(getReservationDetail).mockResolvedValue(reservationFixture(status));
      const tree = await ReservationDetailPage({ params: Promise.resolve({ id: "reservation-a" }) });
      const nodes = elements(tree);
      const serialized = JSON.stringify(tree, (_key, value) => React.isValidElement(value) ? value.props : value);
      expect(getReservationLedger).not.toHaveBeenCalled();
      expect(getReservationDetail).toHaveBeenCalledWith(owner.organizationId, "reservation-a");
      expect(expireStaleHolds).toHaveBeenCalledWith(db, owner.organizationId);
      expect(listOpenDamageReports).not.toHaveBeenCalled();
      for (const component of [PaymentsCard, RecordPaymentForm, RecordRefundForm, AddDeductionForm, GuestLinkCard]) {
        expect(nodes.some((node) => node.type === component)).toBe(false);
      }
      for (const secret of ["Charges", "Private negotiated rate", "Private deposit", "765432", "123456", "private-payment-reference", "654321", "Booking total", "Refundable deposit"]) {
        expect(serialized).not.toContain(secret);
      }
      for (const detail of ["Guest Example", "guest@example.com", "Operational unit", "Operational property", "Arrives late", "History", "Booking created"]) {
        expect(serialized).toContain(detail);
      }
      for (const component of [CheckInForm, CheckOutForm, DamageReportForm]) {
        expect(nodes.some((node) => node.type === component)).toBe(false);
      }
      const hasLink = (suffix: string) => nodes.some((node) => node.props.href === `/reservations/reservation-a/${suffix}`);
      expect(hasLink("check-in")).toBe(status === "confirmed");
      expect(hasLink("check-out")).toBe(status === "checked_in");
      expect(hasLink("damage/new")).toBe(status === "checked_in" || status === "checked_out");
      for (const suffix of ["payments/new", "refunds/new", "deductions/new", "confirm", "cancel"]) expect(hasLink(suffix)).toBe(false);
      if (status === "checked_out") {
        expect(getTaskForReservation).toHaveBeenCalledWith(owner.organizationId, "reservation-a");
        expect(nodes.some((node) => node.props.href === "/tasks/turnover-a")).toBe(true);
      } else {
        expect(getTaskForReservation).not.toHaveBeenCalled();
      }
    },
  );

  it("loads and renders financial data and controls for owners", async () => {
    vi.mocked(requireMembership).mockResolvedValue(owner);
    vi.mocked(getReservationDetail).mockResolvedValue(reservationFixture("checked_in"));
    const tree = await ReservationDetailPage({ params: Promise.resolve({ id: "reservation-a" }) });
    const nodes = elements(tree);
    expect(getReservationLedger).toHaveBeenCalledExactlyOnceWith(owner.organizationId, "reservation-a");
    const paymentCard = nodes.find((node) => node.type === PaymentsCard);
    expect(paymentCard?.props.ledger).toEqual(await vi.mocked(getReservationLedger).mock.results[0]?.value);
    expect(paymentCard?.props.isOwner).toBe(true);
    for (const component of [PaymentsCard, GuestLinkCard]) {
      expect(nodes.some((node) => node.type === component)).toBe(true);
    }
    for (const component of [RecordPaymentForm, RecordRefundForm, AddDeductionForm, CheckOutForm, DamageReportForm]) {
      expect(nodes.some((node) => node.type === component)).toBe(false);
    }
    for (const suffix of ["payments/new", "refunds/new", "deductions/new", "check-out", "damage/new"]) {
      expect(nodes.some((node) => node.props.href === `/reservations/reservation-a/${suffix}`)).toBe(true);
    }
    const serialized = JSON.stringify(tree, (_key, value) => React.isValidElement(value) ? value.props : value);
    expect(serialized).toContain("Booking charges");
    expect(serialized).toContain("Private negotiated rate");
    expect(serialized).toContain("private-payment-reference");
  });
});
