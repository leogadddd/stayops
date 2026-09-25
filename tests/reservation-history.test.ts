import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ReservationHistory } from "@/app/(app)/reservations/[id]/reservation-history";

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

const transitions = [
  { id: "t1", fromStatus: null, toStatus: "hold" as const, note: "Hold placed", createdAt: new Date("2026-09-01T02:00:00Z") },
  { id: "t2", fromStatus: "hold" as const, toStatus: "confirmed" as const, note: null, createdAt: new Date("2026-09-03T02:00:00Z") },
];
const ledger = {
  payments: [
    // Received on the 2nd, but only entered on the 4th.
    { id: "p1", amountCents: 300_000, method: "gcash", allocation: "booking", reference: "GC-123", reversalOfId: null, receivedAt: new Date("2026-09-02T02:00:00Z"), createdAt: new Date("2026-09-04T02:00:00Z") },
    { id: "p2", amountCents: -300_000, method: "gcash", allocation: "booking", reference: null, reversalOfId: "p1", receivedAt: new Date("2026-09-05T02:00:00Z"), createdAt: new Date("2026-09-05T02:00:00Z") },
  ],
  refunds: [{ id: "r1", amountCents: 50_000, method: "cash", allocation: "security_deposit", reason: "Deposit returned", refundedAt: new Date("2026-09-06T02:00:00Z") }],
  deductions: [{ id: "d1", amountCents: 80_000, reason: "Stained linens", createdAt: new Date("2026-09-05T12:00:00Z") }],
  proofs: [{ id: "f1", reference: "Screenshot", note: null, status: "unverified", createdAt: new Date("2026-09-01T12:00:00Z") }],
} as unknown as React.ComponentProps<typeof ReservationHistory>["ledger"];

describe("reservation history", () => {
  it("merges status changes and money movements in the order they happened", () => {
    const html = renderToStaticMarkup(React.createElement(ReservationHistory, { transitions, ledger, timeZone: "Asia/Manila" }));
    const order = ["Hold placed", "Guest sent payment proof", "Payment received", "Confirmed", "Payment reversed", "Kept from deposit", "Refund"].map((text) => html.indexOf(text));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html).toContain("₱3,000");
    expect(html).toContain("ref GC-123");
    expect(html).toContain("from security deposit");
    expect(html).toContain("Stained linens");
    // A payment entered two days after it arrived says so.
    expect(html).toMatch(/recorded Sep 4, 2026/);
  });

  it("shows staff status changes only", () => {
    const html = renderToStaticMarkup(React.createElement(ReservationHistory, { transitions, ledger: null, timeZone: "Asia/Manila" }));
    expect(html).toContain("Hold placed");
    expect(html).not.toMatch(/₱|Payment|Refund|deposit/);
  });
});
