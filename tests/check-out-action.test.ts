import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireMembership } from "@/lib/auth/session";
import { checkIn, checkOut } from "@/server/operations/service";
import { checkInAction, checkOutAction } from "@/app/(app)/reservations/actions";

vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/session")>(),
  requireMembership: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: {} }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/operations/service", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/server/operations/service")>(),
  checkIn: vi.fn(),
  checkOut: vi.fn(),
}));

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("check-in and check-out actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireMembership).mockResolvedValue({ organizationId: "org-a", organizationName: "Stays", organizationSlug: "stays", userId: "staff-a", role: "staff" });
  });

  it("passes the actual departure time to check-out, so the turnover starts then", async () => {
    await checkOutAction("reservation-a", {}, form({ actualCheckoutAt: "2026-09-27T09:30", note: "Left early" }));
    expect(checkOut).toHaveBeenCalledWith(expect.objectContaining({
      reservationId: "reservation-a",
      data: { note: "Left early", actualCheckoutAt: "2026-09-27T09:30" },
    }));
  });

  it("lets check-out default to now when no time is given", async () => {
    await checkOutAction("reservation-a", {}, form({ note: "" }));
    expect(vi.mocked(checkOut).mock.calls[0]![0].data).toEqual({ note: "", actualCheckoutAt: undefined });
  });

  it("sends check-in only its note", async () => {
    await checkInAction("reservation-a", {}, form({ note: "Key handed over" }));
    expect(vi.mocked(checkIn).mock.calls[0]![0].data).toEqual({ note: "Key handed over" });
  });
});
