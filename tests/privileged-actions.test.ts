import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { assertOwner, PermissionError, requireMembership, type MembershipContext } from "@/lib/auth/session";
import * as payments from "@/server/payments/service";
import * as orgs from "@/server/orgs/service";
import * as inventory from "@/server/inventory/service";
import { createExpense } from "@/server/expenses/service";
import { updateChecklistTemplate } from "@/server/operations/service";
import {
  addDeductionAction, dismissProofAction, recordPaymentAction,
  recordProofPaymentAction, recordRefundAction,
} from "@/app/(app)/reservations/[id]/payment-actions";
import {
  inviteStaffAction, removeStaffAction, renameOrganization, savePaymentInstructions,
} from "@/app/(app)/settings/actions";
import {
  createPropertyAction, createUnitAction, updatePropertyAction,
  updateUnitAction, updateChecklistTemplateAction, deletePropertyAction,
  deleteUnitAction,
} from "@/app/(app)/properties/actions";
import {
  addUnitBlockAction, removeUnitBlockAction,
} from "@/app/(app)/properties/[propertyId]/units/block-actions";
import { createExpenseAction } from "@/app/(app)/expenses/actions";
import { createReservationAction } from "@/app/(app)/reservations/actions";
import { createHold, createConfirmed } from "@/server/reservations/service";

// Exercise the production role check instead of duplicating its policy in a mock.
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/session")>(),
  requireMembership: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: {} }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/payments/service", () => ({
  recordPayment: vi.fn(), recordRefund: vi.fn(),
  addDeduction: vi.fn(), dismissProof: vi.fn(),
}));
vi.mock("@/server/orgs/service", () => ({
  inviteStaff: vi.fn(), removeStaff: vi.fn(),
  updateOrganizationName: vi.fn(), updatePaymentInstructions: vi.fn(),
  OrgError: class extends Error {},
}));
vi.mock("@/server/expenses/service", () => ({
  createExpense: vi.fn(), ExpenseError: class extends Error {},
}));
vi.mock("@/server/inventory/service", () => ({
  createProperty: vi.fn(), updateProperty: vi.fn(),
  createUnit: vi.fn(), updateUnit: vi.fn(), deleteProperty: vi.fn(), deleteUnit: vi.fn(),
  addUnitBlock: vi.fn(), removeUnitBlock: vi.fn(), getUnitOrThrow: vi.fn(),
}));
vi.mock("@/server/reservations/service", () => ({ createHold: vi.fn(), createConfirmed: vi.fn() }));
vi.mock("@/server/reservations/guest-link", () => ({ createGuestLink: vi.fn(), revokeGuestLink: vi.fn() }));
vi.mock("@/server/operations/service", () => ({
  updateChecklistTemplate: vi.fn(), OperationsError: class extends Error {},
}));

const owner: MembershipContext = {
  organizationId: "trusted-org", organizationName: "Test stays",
  organizationSlug: "test-stays", userId: "trusted-actor", role: "owner",
};
const staff: MembershipContext = { ...owner, role: "staff" };

function formData() {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    amountPesos: "100.00", allocation: "booking", method: "cash",
    reason: "Test reason", reference: "test-reference", idempotencyKey: "test-key",
    name: "Test property", email: "staff@example.com", paymentInstructions: "Pay the owner",
    capacity: "2", bedrooms: "1", bathrooms: "1", nightlyRate: "100.00", status: "active",
    templateJson: '[{"label":"Clean room"}]',
    propertyId: "property-a", description: "Cleaning", category: "cleaning",
    classification: "operating", paidDate: "2026-09-01",
    startDate: "2026-09-01", endDate: "2026-09-02",
    organizationId: "untrusted-org", actorUserId: "untrusted-actor", role: "owner",
  })) form.set(key, value);
  return form;
}

const actions = [
  { name: "record payment", invoke: (form: FormData) => recordPaymentAction("reservation-a", {}, form), write: payments.recordPayment, target: { reservationId: "reservation-a" } },
  { name: "record payment from proof", invoke: (form: FormData) => recordProofPaymentAction("reservation-a", "proof-a", {}, form), write: payments.recordPayment, target: { reservationId: "reservation-a", proofId: "proof-a" } },
  { name: "record refund", invoke: (form: FormData) => recordRefundAction("reservation-a", {}, form), write: payments.recordRefund, target: { reservationId: "reservation-a" } },
  { name: "add deposit deduction", invoke: (form: FormData) => addDeductionAction("reservation-a", {}, form), write: payments.addDeduction, target: { reservationId: "reservation-a" } },
  { name: "dismiss proof", invoke: (form: FormData) => dismissProofAction("reservation-a", "proof-a", {}, form), write: payments.dismissProof, target: { proofId: "proof-a" } },
  { name: "rename organization", invoke: (form: FormData) => renameOrganization({}, form), write: orgs.updateOrganizationName, target: {} },
  { name: "save payment instructions", invoke: (form: FormData) => savePaymentInstructions({}, form), write: orgs.updatePaymentInstructions, target: {} },
  { name: "invite staff", invoke: (form: FormData) => inviteStaffAction({}, form), write: orgs.inviteStaff, target: {} },
  { name: "remove staff", invoke: () => removeStaffAction("membership-a"), write: orgs.removeStaff, target: { membershipId: "membership-a" } },
  { name: "create expense", invoke: (form: FormData) => createExpenseAction({}, form), write: createExpense, target: {} },
  { name: "create property", invoke: (form: FormData) => createPropertyAction({}, form), write: inventory.createProperty, target: {} },
  { name: "update property", invoke: (form: FormData) => updatePropertyAction("property-a", {}, form), write: inventory.updateProperty, target: { propertyId: "property-a" } },
  { name: "delete property", invoke: () => deletePropertyAction("property-a"), write: inventory.deleteProperty, target: { propertyId: "property-a" } },
  { name: "create unit", invoke: (form: FormData) => createUnitAction("property-a", {}, form), write: inventory.createUnit, target: { propertyId: "property-a" } },
  { name: "update unit", invoke: (form: FormData) => updateUnitAction("property-a", "unit-a", {}, form), write: inventory.updateUnit, target: { unitId: "unit-a" } },
  { name: "delete unit", invoke: () => deleteUnitAction("property-a", "unit-a"), write: inventory.deleteUnit, target: { unitId: "unit-a" } },
  { name: "update checklist template", invoke: (form: FormData) => updateChecklistTemplateAction("property-a", "unit-a", {}, form), write: updateChecklistTemplate, target: { unitId: "unit-a" } },
  { name: "add unit block", invoke: (form: FormData) => addUnitBlockAction("property-a", "unit-a", {}, form), write: inventory.addUnitBlock, target: { unitId: "unit-a" } },
  { name: "remove unit block", invoke: () => removeUnitBlockAction("property-a", "unit-a", "block-a"), write: inventory.removeUnitBlock, target: { blockId: "block-a" } },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireMembership).mockResolvedValue(staff);
});

describe("staff reservation pricing", () => {
  it("ignores supplied charge amounts and uses trusted unit defaults for holds", async () => {
    const form = formData();
    const unitId = "11111111-1111-4111-8111-111111111111";
    form.set("unitId", unitId);
    form.set("checkIn", "2026-09-28");
    form.set("checkOut", "2026-09-30");
    form.set("chargesJson", "malformed untrusted prices");
    vi.mocked(inventory.getUnitOrThrow).mockResolvedValue({
      defaultNightlyRateCents: 250_000, cleaningFeeCents: 50_000, securityDepositCents: 100_000,
    } as Awaited<ReturnType<typeof inventory.getUnitOrThrow>>);
    vi.mocked(createHold).mockResolvedValue({ id: "hold-a" } as Awaited<ReturnType<typeof createHold>>);
    expect(await createReservationAction({}, form)).toEqual({ success: true, reservationId: "hold-a" });
    expect(inventory.getUnitOrThrow).toHaveBeenCalledWith(owner.organizationId, unitId);
    expect(createHold).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: owner.organizationId,
      data: expect.objectContaining({ charges: [
        { type: "accommodation", description: "Accommodation (2 nights)", quantity: 2, unitAmountCents: 250_000 },
        { type: "cleaning", description: "Cleaning fee", quantity: 1, unitAmountCents: 50_000 },
        { type: "security_deposit", description: "Refundable security deposit", quantity: 1, unitAmountCents: 100_000 },
      ] }),
    }));
    expect(createConfirmed).not.toHaveBeenCalled();
  });

  it("rejects a staff member requesting a confirmed booking", async () => {
    const form = formData();
    form.set("mode", "confirmed");
    await expect(createReservationAction({}, form)).rejects.toThrow(PermissionError);
    expect(createConfirmed).not.toHaveBeenCalled();
    expect(createHold).not.toHaveBeenCalled();
  });
});

describe("owner-only mutation boundaries", () => {
  it("uses the production owner assertion", () => {
    expect(() => assertOwner(staff)).toThrow(PermissionError);
    expect(() => assertOwner(owner)).not.toThrow();
  });

  it.each(actions)("rejects staff attempting to $name before any write or revalidation", async ({ invoke }) => {
    const form = formData();
    const read = vi.spyOn(form, "get");
    await expect(invoke(form)).rejects.toThrow(PermissionError);
    expect(requireMembership).toHaveBeenCalledOnce();
    expect(read).not.toHaveBeenCalled();
    for (const { write } of actions) expect(write).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each(actions)("allows owners to $name using trusted session scope", async ({ invoke, write, target }) => {
    vi.mocked(requireMembership).mockResolvedValue(owner);
    await invoke(formData());
    expect(requireMembership).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      organizationId: owner.organizationId,
      actorUserId: owner.userId,
      ...target,
    }));
    expect(revalidatePath).toHaveBeenCalled();
  });
});
