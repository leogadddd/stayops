import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useRouter } from "next/navigation";
import { setToastAfterNavigation } from "@/components/ui/sonner";
import { useReservationSaved } from "@/app/(app)/reservations/[id]/use-reservation-saved";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireMembership, requirePermission, type MembershipContext } from "@/lib/auth/session";
import { permissionGuardFor } from "./helpers/session-mock";
import { PermissionDenied } from "@/components/app/permission-denied";
import { Table } from "@/components/ui/table";
import { getReservationDetail, isLiveHold, listReservations, ReservationError } from "@/server/reservations/service";
import { expireStaleHolds } from "@/server/reservations/holds";
import { getReservationLedger, recordPayment } from "@/server/payments/service";
import { getTaskForReservation, listOpenDamageReports } from "@/server/operations/service";
import { listOrgUnits } from "@/server/inventory/service";
import NewPaymentPage from "@/app/(app)/reservations/[id]/payments/new/page";
import NewRefundPage from "@/app/(app)/reservations/[id]/refunds/new/page";
import NewDeductionPage from "@/app/(app)/reservations/[id]/deductions/new/page";
import ConfirmPage from "@/app/(app)/reservations/[id]/confirm/page";
import CancelPage from "@/app/(app)/reservations/[id]/cancel/page";
import CheckInPage from "@/app/(app)/reservations/[id]/check-in/page";
import CheckOutPage from "@/app/(app)/reservations/[id]/check-out/page";
import DamagePage from "@/app/(app)/reservations/[id]/damage/new/page";
import RecordProofPage from "@/app/(app)/reservations/[id]/proofs/[proofId]/record/page";
import ReservationDetailPage from "@/app/(app)/reservations/[id]/page";
import ReservationsPage from "@/app/(app)/reservations/page";
import { RecordPaymentForm } from "@/app/(app)/reservations/[id]/record-payment-form";
import { RecordRefundForm } from "@/app/(app)/reservations/[id]/record-refund-form";
import { AddDeductionForm } from "@/app/(app)/reservations/[id]/add-deduction-form";
import { ConfirmHoldForm } from "@/app/(app)/reservations/[id]/confirm-hold-form";
import { CancelReservationForm } from "@/app/(app)/reservations/[id]/cancel-reservation-form";
import { CheckInForm } from "@/app/(app)/reservations/[id]/check-in-form";
import { CheckOutForm } from "@/app/(app)/reservations/[id]/check-out-form";
import { DamageReportForm } from "@/app/(app)/tasks/damage-report-form";
import { RecordProofForm } from "@/app/(app)/reservations/[id]/record-proof-form";
import { PaymentsCard } from "@/app/(app)/reservations/[id]/payments-card";
import { ProofQueue } from "@/app/(app)/reservations/[id]/proof-queue";
import { recordProofPaymentAction } from "@/app/(app)/reservations/[id]/payment-actions";

vi.mock("@/lib/auth/session", async () => {
  const { can } = await import("@/lib/permissions");
  return {
    requireMembership: vi.fn(),
    requirePermission: vi.fn(),
    PermissionError: class extends Error {},
    assertCan: (membership: MembershipContext, permission: Parameters<typeof can>[1]) => {
      if (!can(membership, permission)) throw new Error("Owner only");
    },
  };
});
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => { throw new Error("Not found"); }),
  useRouter: vi.fn(() => ({ replace: vi.fn(), refresh: vi.fn() })),
}));
vi.mock("@/components/ui/sonner", () => ({ setToastAfterNavigation: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/server/reservations/service", () => ({ getReservationDetail: vi.fn(), isLiveHold: vi.fn(), listReservations: vi.fn(), ReservationError: class extends Error {} }));
vi.mock("@/server/reservations/platforms", () => ({ listPlatforms: vi.fn(async () => []) }));
vi.mock("@/server/reservations/holds", () => ({ expireStaleHolds: vi.fn() }));
vi.mock("@/server/payments/service", () => ({ getReservationLedger: vi.fn(), recordPayment: vi.fn(), dismissProof: vi.fn() }));
vi.mock("@/server/operations/service", () => ({ getTaskForReservation: vi.fn(), listOpenDamageReports: vi.fn() }));
vi.mock("@/server/inventory/service", () => ({ listOrgUnits: vi.fn() }));
vi.mock("@/app/(app)/reservations/actions", () => ({}));
vi.mock("@/app/(app)/tasks/actions", () => ({}));

const owner: MembershipContext = { organizationId: "org-a", organizationName: "Test", organizationSlug: "test", role: "owner", userId: "owner-a" };
const staff: MembershipContext = { ...owner, role: "staff", userId: "staff-a" };
const params = Promise.resolve({ id: "reservation-a", proofId: "proof-a" });
type Status = "hold" | "confirmed" | "checked_in" | "checked_out" | "cancelled" | "expired";
function fixture(status: Status = "confirmed") {
  return {
    reservation: { id: "reservation-a", status, expiresAt: status === "hold" ? new Date("2099-01-01") : null, checkInDate: "2026-09-01", checkOutDate: "2026-09-03", guestCount: 2 },
    guest: { name: "Test guest", email: "test@example.com", phone: null, notes: "Late arrival" },
    unit: { id: "unit-a", name: "Test unit" }, property: { name: "Test property" }, activeToken: null,
    charges: [{ id: "charge-a", type: "security_deposit", description: "Private deposit", quantity: 1, unitAmountCents: 123456, amountCents: 123456 }],
    transitions: [{ id: "transition-a", fromStatus: null, toStatus: "confirmed", note: "Created booking", createdAt: new Date("2026-08-01") }],
  } as Awaited<ReturnType<typeof getReservationDetail>>;
}
function ledgerFixture() {
  return {
    balances: { bookingTotalCents: 50000, paidBookingCents: 50000, refundedBookingCents: 0, bookingBalanceCents: 0, depositTotalCents: 123456, paidDepositCents: 123456, depositHeldCents: 123456 },
    payments: [{ id: "payment-a", method: "gcash", allocation: "booking", amountCents: 50000, reference: null, receivedAt: new Date("2026-08-01") }], refunds: [], deductions: [],
    proofs: [{ id: "proof-a", organizationId: "org-a", reservationId: "reservation-a", status: "unverified", reference: "Test reference", note: "Please verify", createdAt: new Date("2026-08-01") }],
  } as unknown as Awaited<ReturnType<typeof getReservationLedger>>;
}
function nodes(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...nodes(node.props.children as React.ReactNode)];
}
function serialize(tree: React.ReactNode) {
  return JSON.stringify(tree, (_key, value) => React.isValidElement(value) ? value.props : value);
}

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireMembership).mockResolvedValue(staff);
  // Follows requireMembership, like the real guard, unless a test overrides it.
  vi.mocked(requirePermission).mockImplementation(permissionGuardFor(() => requireMembership()));
  vi.mocked(getReservationDetail).mockResolvedValue(fixture());
  vi.mocked(getReservationLedger).mockResolvedValue(ledgerFixture());
  vi.mocked(listOpenDamageReports).mockResolvedValue([]);
  vi.mocked(getTaskForReservation).mockResolvedValue(null);
  vi.mocked(isLiveHold).mockImplementation((status) => status === "hold");
});

const ownerPages = [
  { name: "payment", page: NewPaymentPage, form: RecordPaymentForm, status: "confirmed" },
  { name: "refund", page: NewRefundPage, form: RecordRefundForm, status: "confirmed" },
  { name: "deduction", page: NewDeductionPage, form: AddDeductionForm, status: "confirmed" },
  { name: "confirm", page: ConfirmPage, form: ConfirmHoldForm, status: "hold" },
  { name: "cancel", page: CancelPage, form: CancelReservationForm, status: "confirmed" },
  { name: "proof", page: RecordProofPage, form: RecordProofForm, status: "confirmed" },
] as const;
const memberPages = [
  { name: "check-in", page: CheckInPage, form: CheckInForm, status: "confirmed" },
  { name: "check-out", page: CheckOutPage, form: CheckOutForm, status: "checked_in" },
  { name: "damage", page: DamagePage, form: DamageReportForm, status: "checked_in" },
] as const;
const reads = [expireStaleHolds, getReservationDetail, getReservationLedger, listOpenDamageReports];

describe("dedicated reservation action pages", () => {
  it.each(ownerPages)("denies staff on $name before any protected read", async ({ page }) => {
    const tree = await page({ params });
    expect(tree.type).toBe(PermissionDenied);
    expect(requirePermission).toHaveBeenCalledOnce();
    for (const read of reads) expect(read).not.toHaveBeenCalled();
  });

  it.each(ownerPages)("loads the existing $name form for owners after the guard", async ({ page, form, status }) => {
    vi.mocked(requirePermission).mockResolvedValue(owner);
    vi.mocked(getReservationDetail).mockResolvedValue(fixture(status));
    const tree = await page({ params });
    expect(nodes(tree).some((node) => node.type === form)).toBe(true);
    expect(getReservationDetail).toHaveBeenCalledExactlyOnceWith(owner.organizationId, "reservation-a");
    expect(vi.mocked(requirePermission).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(getReservationDetail).mock.invocationCallOrder[0]!);
    expect(tree.props.reservationId).toBe("reservation-a");
  });

  it.each(memberPages)("allows staff $name without financial props or ledger reads", async ({ page, form, status }) => {
    vi.mocked(getReservationDetail).mockResolvedValue(fixture(status));
    const tree = await page({ params });
    expect(requireMembership).toHaveBeenCalledOnce();
    expect(getReservationLedger).not.toHaveBeenCalled();
    const client = nodes(tree).find((node) => node.type === form);
    expect(client?.props).toEqual(form === DamageReportForm ? { unitId: "unit-a", reservationId: "reservation-a", returnHref: "/reservations/reservation-a" } : form === CheckOutForm ? { reservationId: "reservation-a", timeZone: "Asia/Manila" } : { reservationId: "reservation-a" });
    expect(serialize(tree)).not.toMatch(/123456|Private deposit|amountCents|ledger/);
  });

  it.each(memberPages)("authenticates before reading $name", async ({ page }) => {
    vi.mocked(requireMembership).mockRejectedValue(new Error("Login required"));
    await expect(page({ params })).rejects.toThrow("Login required");
    for (const read of reads) expect(read).not.toHaveBeenCalled();
  });

  it.each([...ownerPages, ...memberPages])("hides the $name form for an expired reservation", async ({ page, form }) => {
    vi.mocked(requirePermission).mockResolvedValue(owner);
    vi.mocked(getReservationDetail).mockResolvedValue(fixture("expired"));
    const tree = await page({ params });
    expect(nodes(tree).some((node) => node.type === form)).toBe(false);
    expect(tree.props.unavailable).toBeTruthy();
  });

  it("offers a refund only once money was received, and only from where it went", async () => {
    vi.mocked(requirePermission).mockResolvedValue(owner);
    const unpaid = ledgerFixture();
    unpaid.balances = { ...unpaid.balances, paidBookingCents: 0, paidDepositCents: 0, depositHeldCents: 0 };
    vi.mocked(getReservationLedger).mockResolvedValue(unpaid);
    const blocked = await NewRefundPage({ params });
    expect(nodes(blocked).some((node) => node.type === RecordRefundForm)).toBe(false);
    expect(blocked.props.unavailable).toMatch(/no payment/i);

    const depositOnly = ledgerFixture();
    depositOnly.balances = { ...depositOnly.balances, paidBookingCents: 0 };
    vi.mocked(getReservationLedger).mockResolvedValue(depositOnly);
    const form = nodes(await NewRefundPage({ params })).find((node) => node.type === RecordRefundForm);
    expect(form?.props).toMatchObject({ canRefundBooking: false, canRefundDeposit: true });
  });

  it("offers a deposit deduction only once a deposit is held", async () => {
    vi.mocked(requirePermission).mockResolvedValue(owner);
    const noDeposit = ledgerFixture();
    noDeposit.balances = { ...noDeposit.balances, paidDepositCents: 0, depositHeldCents: 0 };
    vi.mocked(getReservationLedger).mockResolvedValue(noDeposit);
    const tree = await NewDeductionPage({ params });
    expect(nodes(tree).some((node) => node.type === AddDeductionForm)).toBe(false);
    expect(tree.props.unavailable).toMatch(/no deposit/i);
  });

  it("disables refund and deduction on the reservation until money is received", async () => {
    vi.mocked(requireMembership).mockResolvedValue(owner);
    const unpaid = ledgerFixture();
    unpaid.balances = { ...unpaid.balances, paidBookingCents: 0, paidDepositCents: 0, depositHeldCents: 0 };
    vi.mocked(getReservationLedger).mockResolvedValue(unpaid);
    const html = serialize(await ReservationDetailPage({ params }));
    expect(html).toContain("/reservations/reservation-a/payments/new");
    expect(html).not.toContain("/reservations/reservation-a/refunds/new");
    expect(html).not.toContain("/reservations/reservation-a/deductions/new");
    expect(html).toContain("No payment recorded yet");
    expect(html).toContain("No deposit collected yet");
  });

  it("maps a missing or foreign reservation to not-found", async () => {
    vi.mocked(requirePermission).mockResolvedValue(owner);
    vi.mocked(getReservationDetail).mockRejectedValue(new ReservationError("Missing"));
    await expect(NewPaymentPage({ params })).rejects.toThrow("Not found");
  });

  it.each(["missing", "other-reservation", "other-organization"])("rejects %s proof identifiers", async (kind) => {
    vi.mocked(requirePermission).mockResolvedValue(owner);
    const ledger = ledgerFixture();
    if (kind === "missing") ledger.proofs = [];
    if (kind === "other-reservation") ledger.proofs[0]!.reservationId = "reservation-b";
    if (kind === "other-organization") ledger.proofs[0]!.organizationId = "org-b";
    vi.mocked(getReservationLedger).mockResolvedValue(ledger);
    await expect(RecordProofPage({ params })).rejects.toThrow("Not found");
  });

  it.each(["recorded", "dismissed"] as const)("does not reopen a %s proof", async (status) => {
    vi.mocked(requirePermission).mockResolvedValue(owner);
    const ledger = ledgerFixture();
    ledger.proofs[0]!.status = status;
    vi.mocked(getReservationLedger).mockResolvedValue(ledger);
    const tree = await RecordProofPage({ params });
    expect(nodes(tree).some((node) => node.type === RecordProofForm)).toBe(false);
    expect(tree.props.unavailable).toBeTruthy();
  });
});

describe("read-only reservation detail and shared tables", () => {
  it.each(["confirmed", "checked_in", "checked_out"] as const)("keeps %s staff links without forms or financial props", async (status) => {
    vi.mocked(getReservationDetail).mockResolvedValue(fixture(status));
    const tree = await ReservationDetailPage({ params });
    const elements = nodes(tree);
    for (const { form } of [...ownerPages, ...memberPages]) expect(elements.some((node) => node.type === form)).toBe(false);
    expect(getReservationLedger).not.toHaveBeenCalled();
    expect(listOpenDamageReports).not.toHaveBeenCalled();
    const serialized = serialize(tree);
    expect(serialized).not.toMatch(/123456|Private deposit|payments\/new|refunds\/new|deductions\/new/);
    expect(serialized).toContain("History");
    expect(serialized).toContain("Late arrival");
    if (status === "confirmed") expect(serialized).toContain("/reservations/reservation-a/check-in");
    else expect(serialized).toContain("/reservations/reservation-a/damage/new");
    if (status === "checked_in") expect(serialized).toContain("/reservations/reservation-a/check-out");
  });

  it("keeps financial links and charge tables for the owner, not embedded forms", async () => {
    vi.mocked(requireMembership).mockResolvedValue(owner);
    const tree = await ReservationDetailPage({ params });
    const elements = nodes(tree);
    expect(elements.some((node) => node.type === Table)).toBe(true);
    expect(elements.some((node) => node.type === PaymentsCard)).toBe(true);
    for (const { form } of ownerPages) expect(elements.some((node) => node.type === form)).toBe(false);
    for (const path of ["payments/new", "refunds/new", "deductions/new", "cancel"]) expect(serialize(tree)).toContain(`/reservations/reservation-a/${path}`);
  });

  it.each([
    ["owner", "confirmed", true],
    ["owner", "checked_in", false],
    ["owner", "checked_out", false],
    ["owner", "cancelled", false],
    ["staff", "confirmed", false],
  ] as const)("shows Edit to %s for a %s reservation: %s", async (role, status, visible) => {
    if (role === "owner") vi.mocked(requireMembership).mockResolvedValue(owner);
    vi.mocked(getReservationDetail).mockResolvedValue(fixture(status));
    const html = serialize(await ReservationDetailPage({ params }));
    expect(html.includes("/reservations/reservation-a/edit")).toBe(visible);
  });

  it("uses the shared Table for the reservations list", async () => {
    vi.mocked(listOrgUnits).mockResolvedValue([]);
    vi.mocked(listReservations).mockResolvedValue([{ ...fixture().reservation, guestName: "Test guest", unitName: "Test unit", propertyName: "Test property", platformName: "Airbnb", platformLogoUrl: null, platformColor: "#FF5A5F", createdAt: new Date("2026-08-01T02:00:00Z") }] as Awaited<ReturnType<typeof listReservations>>);
    const tree = await ReservationsPage({ searchParams: Promise.resolve({}) });
    expect(nodes(tree).some((node) => node.type === Table)).toBe(true);
    const html = renderToStaticMarkup(tree);
    for (const heading of ["Ref", "Guest", "Unit", "Check-in", "Check-out", "Nights", "Guests", "Platform", "Created at", "Status", "Actions"]) expect(html).toContain(`>${heading}</th>`);
    // Staff never see money columns.
    expect(html).not.toContain(">Total</th>");
    expect(html).toContain('href="/reservations/reservation-a"');
  });

  it("uses shared tables for all three financial movement lists", () => {
    const tree = PaymentsCard({ reservationId: "reservation-a", ledger: ledgerFixture(), canReviewProofs: true });
    expect(nodes(tree).filter((node) => node.type === Table)).toHaveLength(3);
  });

  it("renders proof review links and no expandable data-entry form", () => {
    const html = renderToStaticMarkup(React.createElement(ProofQueue, { reservationId: "reservation-a", proofs: ledgerFixture().proofs }));
    expect(html).toContain('data-slot="table"');
    expect(html).toContain('href="/reservations/reservation-a/proofs/proof-a/record"');
    expect(html).not.toContain('name="amountPesos"');
    expect(html).not.toContain("<input");
  });
});

type SaveState = { success?: boolean; error?: string };
type SaveAction = (previous: SaveState, formData: FormData) => Promise<SaveState>;

function captureSave(action: SaveAction) {
  let save!: SaveAction;
  function SaveHarness() {
    save = useReservationSaved(action, "reservation-a", "Payment recorded.");
    return null;
  }
  renderToStaticMarkup(React.createElement(SaveHarness));
  return save;
}

describe("reservation submission navigation", () => {
  const navigation = { replace: vi.fn(), refresh: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useRouter).mockReturnValue(navigation as unknown as ReturnType<typeof useRouter>);
  });

  it("navigates after the save resolves without needing a success render or effect", async () => {
    const pending = Promise.withResolvers<SaveState>();
    const action = vi.fn<SaveAction>(() => pending.promise);
    const save = captureSave(action);
    const previous = { error: "Earlier error" };
    const data = new FormData();
    const result = save(previous, data);
    expect(action).toHaveBeenCalledExactlyOnceWith(previous, data);
    expect(navigation.replace).not.toHaveBeenCalled();
    pending.resolve({ success: true });
    await expect(result).resolves.toEqual({ success: true });
    expect(setToastAfterNavigation).toHaveBeenCalledExactlyOnceWith("success", "Payment recorded.");
    expect(navigation.replace).toHaveBeenCalledExactlyOnceWith("/reservations/reservation-a");
    expect(navigation.refresh).toHaveBeenCalledOnce();
  });

  it("returns validation errors without navigating", async () => {
    const error = { error: "Check the submitted details." };
    const save = captureSave(async () => error);
    await expect(save({}, new FormData())).resolves.toBe(error);
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it("does not navigate or hide unexpected action failures", async () => {
    const save = captureSave(async () => { throw new Error("Save unavailable"); });
    await expect(save({}, new FormData())).rejects.toThrow("Save unavailable");
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(navigation.refresh).not.toHaveBeenCalled();
  });
});

describe("proof payment retry safety", () => {
  it("uses the same trusted idempotency key for every submission of a proof", async () => {
    vi.mocked(requireMembership).mockResolvedValue(owner);
    const form = new FormData();
    form.set("amountPesos", "100"); form.set("allocation", "booking"); form.set("method", "gcash");
    form.set("idempotencyKey", "untrusted-key");
    await recordProofPaymentAction("reservation-a", "proof-a", {}, form);
    await recordProofPaymentAction("reservation-a", "proof-a", {}, form);
    expect(recordPayment).toHaveBeenCalledTimes(2);
    for (const [input] of vi.mocked(recordPayment).mock.calls) {
      expect(input).toMatchObject({ organizationId: owner.organizationId, reservationId: "reservation-a", proofId: "proof-a", data: { idempotencyKey: "proof:proof-a" } });
    }
  });
});
