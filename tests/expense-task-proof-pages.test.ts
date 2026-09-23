import * as React from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireMembership, requireOwner, type MembershipContext } from "@/lib/auth/session";
import { listProperties, listOrgUnits } from "@/server/inventory/service";
import { listExpenses } from "@/server/expenses/service";
import { getTaskDetail, markTaskReady, resolveDamageReport, updateTaskNotes } from "@/server/operations/service";
import { getGuestViewByToken, type GuestView } from "@/server/reservations/guest-link";
import { submitGuestPaymentProof } from "@/server/payments/service";
import { PermissionDenied } from "@/components/app/permission-denied";
import { Table } from "@/components/ui/table";
import ExpensesPage from "@/app/(app)/expenses/page";
import NewExpensePage from "@/app/(app)/expenses/new/page";
import { ExpenseForm } from "@/app/(app)/expenses/expense-form";
import TaskDetailPage from "@/app/(app)/tasks/[id]/page";
import EditTaskPage from "@/app/(app)/tasks/[id]/edit/page";
import NewTaskDamagePage from "@/app/(app)/tasks/[id]/damage/new/page";
import ResolveTaskDamagePage from "@/app/(app)/tasks/[id]/damage/[damageReportId]/resolve/page";
import TaskReadyPage from "@/app/(app)/tasks/[id]/ready/page";
import { Checklist } from "@/app/(app)/tasks/[id]/checklist";
import { TaskNotesForm } from "@/app/(app)/tasks/[id]/task-notes-form";
import { MarkReadyForm } from "@/app/(app)/tasks/[id]/mark-ready-form";
import { ResolveDamageForm } from "@/app/(app)/tasks/[id]/resolve-damage-form";
import { DamageReportForm } from "@/app/(app)/tasks/damage-report-form";
import { markTaskReadyAction, resolveDamageReportAction, updateTaskNotesAction } from "@/app/(app)/tasks/actions";
import GuestStatusPage from "@/app/g/[token]/page";
import NewGuestPaymentProofPage from "@/app/g/[token]/payment-proof/new/page";
import { SubmitProofForm } from "@/app/g/[token]/submit-proof-form";
import { submitPaymentProofAction } from "@/app/g/[token]/actions";

vi.mock("@/lib/auth/session", () => ({
  requireMembership: vi.fn(),
  requireOwner: vi.fn(),
  PermissionError: class extends Error {},
  assertOwner: (membership: MembershipContext) => {
    if (membership.role !== "owner") throw new Error("Owner only");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`Redirect: ${url}`); },
  notFound: () => { throw new Error("Not found"); },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/server/inventory/service", () => ({ listProperties: vi.fn(), listOrgUnits: vi.fn() }));
vi.mock("@/server/expenses/service", () => ({ listExpenses: vi.fn(), createExpense: vi.fn(), ExpenseError: class extends Error {} }));
vi.mock("@/server/operations/service", () => ({
  getTaskDetail: vi.fn(), listTasks: vi.fn(), createDamageReport: vi.fn(),
  markTaskReady: vi.fn(), resolveDamageReport: vi.fn(), updateTaskNotes: vi.fn(),
  setTaskItemCompleted: vi.fn(), OperationsError: class extends Error {},
}));
vi.mock("@/server/reservations/guest-link", () => ({ getGuestViewByToken: vi.fn() }));
vi.mock("@/server/payments/service", () => ({ submitGuestPaymentProof: vi.fn() }));

const owner: MembershipContext = {
  organizationId: "org-a", organizationName: "Test stays", organizationSlug: "test-stays",
  userId: "owner-a", role: "owner",
};
const staff: MembershipContext = { ...owner, userId: "staff-a", role: "staff" };
const params = Promise.resolve({ id: "task-a" });
const resolveParams = Promise.resolve({ id: "task-a", damageReportId: "damage-a" });
const tokenParams = Promise.resolve({ token: "opaque-token" });

function taskFixture({ ready = false, completed = true, damage = true } = {}) {
  return {
    task: { id: "task-a", unitId: "unit-a", organizationId: "org-a", status: ready ? "ready" : "open", notes: "Spare key with guard", markedReadyAt: null, readyOverrideReason: null, reservationId: null },
    unitName: "Unit A", propertyName: "Property A", nextCheckIn: null,
    items: [{ id: "item-a", label: "Clean linens", required: true, completedAt: completed ? new Date() : null }],
    openDamage: damage ? [{ id: "damage-a", unitId: "unit-a", organizationId: "org-a", description: "Broken shelf", estimatedAmountCents: 15000, createdAt: new Date() }] : [],
    assessment: { canMarkReady: completed && !damage, openDamageCount: damage ? 1 : 0, missingRequired: completed ? [] : ["Clean linens"] },
  } as Awaited<ReturnType<typeof getTaskDetail>>;
}
function guestFixture(status = "confirmed"): GuestView {
  return {
    guestName: "Guest Example", propertyName: "Property A", unitName: "Unit A", status,
    checkInDate: "2026-09-20", checkOutDate: "2026-09-23", bookingTotalCents: 300000,
    depositTotalCents: 100000, paidBookingCents: 0, refundedBookingCents: 0,
    bookingBalanceCents: 300000, depositPaidCents: 0, depositHeldCents: 0,
    pendingProofs: 0, paymentInstructions: null, houseRules: null,
  };
}
function elements(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as React.ReactNode)];
}
function links(tree: React.ReactNode) {
  return elements(tree).map((element) => element.props.href).filter(Boolean);
}
function hasForm(tree: React.ReactNode, form: unknown) {
  return elements(tree).some((element) => element.type === form);
}

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireMembership).mockResolvedValue(staff);
  vi.mocked(requireOwner).mockResolvedValue(null);
  vi.mocked(getTaskDetail).mockResolvedValue(taskFixture());
  vi.mocked(listProperties).mockResolvedValue([]);
  vi.mocked(listOrgUnits).mockResolvedValue([]);
  vi.mocked(listExpenses).mockResolvedValue([]);
});

describe("dedicated expense page", () => {
  it("denies staff before protected property and unit reads", async () => {
    expect((await NewExpensePage()).type).toBe(PermissionDenied);
    expect(listProperties).not.toHaveBeenCalled();
    expect(listOrgUnits).not.toHaveBeenCalled();
  });
  it("loads owner-scoped options only on the create page", async () => {
    vi.mocked(requireOwner).mockResolvedValue(owner);
    vi.mocked(listProperties).mockResolvedValue([{ id: "property-a", name: "Property A" }] as Awaited<ReturnType<typeof listProperties>>);
    const tree = await NewExpensePage();
    expect(hasForm(tree, ExpenseForm)).toBe(true);
    expect(listProperties).toHaveBeenCalledWith("org-a");
    expect(listOrgUnits).toHaveBeenCalledWith("org-a");
  });
  it("keeps list creation as a link and uses the shared table", async () => {
    vi.mocked(requireOwner).mockResolvedValue(owner);
    vi.mocked(listExpenses).mockResolvedValue([{ id: "expense-a", paidDate: "2026-09-01", category: "cleaning", classification: "operating", amountCents: 10000, description: "Cleaning", propertyName: "Property A", unitName: null }] as Awaited<ReturnType<typeof listExpenses>>);
    const tree = await ExpensesPage({ searchParams: Promise.resolve({}) });
    expect(hasForm(tree, ExpenseForm)).toBe(false);
    expect(links(tree)).toContain("/expenses/new");
    expect(hasForm(tree, Table)).toBe(true);
    expect(listOrgUnits).not.toHaveBeenCalled();
  });
});

describe("turnover detail and dedicated editors", () => {
  it("keeps checklist toggles but removes embedded editors and staff resolution controls", async () => {
    const tree = await TaskDetailPage({ params });
    expect(elements(tree).find((element) => element.type === Checklist)?.props.editable).toBe(true);
    for (const form of [TaskNotesForm, MarkReadyForm, ResolveDamageForm, DamageReportForm]) expect(hasForm(tree, form)).toBe(false);
    expect(links(tree)).toContain("/tasks/task-a/edit");
    expect(links(tree)).toContain("/tasks/task-a/damage/new");
    expect(links(tree)).not.toContain("/tasks/task-a/damage/damage-a/resolve");
    expect(links(tree)).not.toContain("/tasks/task-a/ready");
    expect(hasForm(tree, Table)).toBe(true);
    expect(getTaskDetail).toHaveBeenCalledWith("org-a", "task-a");
  });
  it("offers owner resolution and override only after required checklist completion", async () => {
    vi.mocked(requireMembership).mockResolvedValue(owner);
    const tree = await TaskDetailPage({ params });
    expect(links(tree)).toContain("/tasks/task-a/damage/damage-a/resolve");
    expect(links(tree)).toContain("/tasks/task-a/ready");
    vi.mocked(getTaskDetail).mockResolvedValue(taskFixture({ completed: false }));
    expect(links(await TaskDetailPage({ params }))).not.toContain("/tasks/task-a/ready");
  });
  it("does not offer edits or new damage on a final ready task", async () => {
    vi.mocked(getTaskDetail).mockResolvedValue(taskFixture({ ready: true }));
    const tree = await TaskDetailPage({ params });
    expect(elements(tree).find((element) => element.type === Checklist)?.props.editable).toBe(false);
    for (const suffix of ["edit", "damage/new", "ready"]) expect(links(tree)).not.toContain(`/tasks/task-a/${suffix}`);
    await expect(EditTaskPage({ params })).rejects.toThrow("Redirect: /tasks/task-a");
    await expect(NewTaskDamagePage({ params })).rejects.toThrow("Redirect: /tasks/task-a");
    await expect(TaskReadyPage({ params })).rejects.toThrow("Redirect: /tasks/task-a");
  });
  it("derives the new damage unit and return destination from the scoped task", async () => {
    const form = elements(await NewTaskDamagePage({ params })).find((element) => element.type === DamageReportForm);
    expect(form?.props).toMatchObject({ unitId: "unit-a", returnHref: "/tasks/task-a" });
  });
  it("guards the owner resolution page before reading any task data", async () => {
    expect((await ResolveTaskDamagePage({ params: resolveParams })).type).toBe(PermissionDenied);
    expect(getTaskDetail).not.toHaveBeenCalled();
  });
  it("rejects damage from another unit or already resolved reports", async () => {
    vi.mocked(requireOwner).mockResolvedValue(owner);
    await expect(ResolveTaskDamagePage({ params: Promise.resolve({ id: "task-a", damageReportId: "other-report" }) })).rejects.toThrow("Not found");
    const form = elements(await ResolveTaskDamagePage({ params: resolveParams })).find((element) => element.type === ResolveDamageForm);
    expect(form?.props).toEqual({ taskId: "task-a", damageReportId: "damage-a" });
  });
  it("never exposes an override form to staff or while required items are missing", async () => {
    expect(hasForm(await TaskReadyPage({ params }), MarkReadyForm)).toBe(false);
    vi.mocked(requireMembership).mockResolvedValue(owner);
    const form = elements(await TaskReadyPage({ params })).find((element) => element.type === MarkReadyForm);
    expect(form?.props.actorRole).toBe("owner");
    vi.mocked(getTaskDetail).mockResolvedValue(taskFixture({ completed: false }));
    expect(hasForm(await TaskReadyPage({ params }), MarkReadyForm)).toBe(false);
  });
});

describe("mutation boundaries", () => {
  it("blocks direct staff damage resolution before reads or writes", async () => {
    await expect(resolveDamageReportAction("task-a", "damage-a", {}, new FormData())).rejects.toThrow("Owner only");
    expect(getTaskDetail).not.toHaveBeenCalled();
    expect(resolveDamageReport).not.toHaveBeenCalled();
  });
  it("rechecks the task/damage relationship before resolving", async () => {
    vi.mocked(requireMembership).mockResolvedValue(owner);
    const result = await resolveDamageReportAction("task-a", "other-report", {}, new FormData());
    expect(result.error).toContain("not found for this task");
    expect(resolveDamageReport).not.toHaveBeenCalled();
    await resolveDamageReportAction("task-a", "damage-a", {}, new FormData());
    expect(resolveDamageReport).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-a", actorUserId: "owner-a", damageReportId: "damage-a" }));
  });
  it("preserves the authenticated actor role for ready overrides", async () => {
    await markTaskReadyAction("task-a", {}, new FormData());
    expect(markTaskReady).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-a", actorRole: "staff", taskId: "task-a" }));
  });
  it("rejects stale notes edits on ready tasks", async () => {
    vi.mocked(getTaskDetail).mockResolvedValue(taskFixture({ ready: true }));
    expect((await updateTaskNotesAction("task-a", {}, new FormData())).error).toContain("already marked ready");
    expect(updateTaskNotes).not.toHaveBeenCalled();
  });
});

describe("public payment reference extraction", () => {
  it("shows the same generic invalid-link state without form or app authentication", async () => {
    vi.mocked(getGuestViewByToken).mockResolvedValue(null);
    const tree = await NewGuestPaymentProofPage({ params: tokenParams });
    expect(hasForm(tree, SubmitProofForm)).toBe(false);
    expect(JSON.stringify(tree)).toContain("This link is not valid");
    expect(getGuestViewByToken).toHaveBeenCalledWith("opaque-token");
    expect(requireMembership).not.toHaveBeenCalled();
    expect(requireOwner).not.toHaveBeenCalled();
  });
  it.each(["hold", "confirmed", "checked_in"])("allows %s token holders to use only the dedicated form", async (status) => {
    vi.mocked(getGuestViewByToken).mockResolvedValue(guestFixture(status));
    const detail = await GuestStatusPage({ params: tokenParams });
    expect(hasForm(detail, SubmitProofForm)).toBe(false);
    expect(links(detail)).toContain("/g/opaque-token/payment-proof/new");
    const form = elements(await NewGuestPaymentProofPage({ params: tokenParams })).find((element) => element.type === SubmitProofForm);
    expect(form?.props).toEqual({ token: "opaque-token" });
    expect(requireMembership).not.toHaveBeenCalled();
  });
  it.each(["cancelled", "expired", "checked_out"])("does not offer submission for %s bookings", async (status) => {
    vi.mocked(getGuestViewByToken).mockResolvedValue(guestFixture(status));
    expect(hasForm(await NewGuestPaymentProofPage({ params: tokenParams }), SubmitProofForm)).toBe(false);
    expect(links(await GuestStatusPage({ params: tokenParams }))).not.toContain("/g/opaque-token/payment-proof/new");
  });
  it("keeps submission authorized by token with no membership dependency", async () => {
    const data = new FormData();
    data.set("reference", " ref-123 ");
    expect(await submitPaymentProofAction("opaque-token", {}, data)).toEqual({ success: true });
    expect(submitGuestPaymentProof).toHaveBeenCalledWith({ token: "opaque-token", data: { reference: "ref-123", note: undefined } });
    expect(requireMembership).not.toHaveBeenCalled();
  });
});
