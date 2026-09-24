import { describe, expect, it } from "vitest";
import { formatAuditDetails, formatAuditTarget, type AuditDisplayEvent } from "@/lib/audit";

function event(action: string, metadata: Record<string, unknown> | null): AuditDisplayEvent {
  return { action, entity: "unit", entityId: "12345678-abcd-4000-8000-123456789abc", metadata };
}

describe("audit display formatting", () => {
  it("names deleted inventory and explains what was retained", () => {
    const deleted = event("unit.deleted", { name: "Garden Suite" });
    expect(formatAuditTarget(deleted)).toEqual({ kind: "Unit", label: "Garden Suite" });
    expect(formatAuditDetails(deleted)).toContain("historical records were kept");
  });

  it("shows property cascade names", () => {
    expect(formatAuditDetails({
      action: "property.deleted",
      entity: "property",
      entityId: "property-a",
      metadata: { name: "Beach House", deletedUnitCount: 2, deletedUnitNames: ["Suite A", "Suite B"] },
    })).toBe("2 units archived with this property. Suite A, Suite B.");
  });

  it("formats financial context from integer centavos", () => {
    expect(formatAuditDetails(event("payment.recorded", {
      amountCents: 125_050,
      allocation: "accommodation",
      method: "bank_transfer",
    }))).toBe("₱1,250.50 · Accommodation · Bank transfer");
  });

  it("falls back to a short reference when old metadata has no name", () => {
    expect(formatAuditTarget(event("unit.updated", null))).toEqual({
      kind: "Unit",
      label: "Unit #12345678",
    });
  });
});
