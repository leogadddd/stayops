import { describe, expect, it } from "vitest";
import { createExpense, listExpenseTotalsByCategory } from "@/server/expenses/service";
import { getMonthlyTrend } from "@/server/reports/service";
import { createTestOrg, createTestProperty } from "./helpers";

async function expense(organizationId: string, actorUserId: string, propertyId: string, category: string, amountPesos: string, paidDate: string, classification = "operating") {
  await createExpense({
    organizationId, actorUserId,
    data: { propertyId, category, amountPesos, description: `${category} spend`, classification, paidDate },
  });
}

describe("dashboard data", () => {
  it("totals expenses by category for the month, largest first and org-scoped", async () => {
    const { org, owner } = await createTestOrg("dash-spend");
    const property = await createTestProperty(org.id, owner.id);
    await expense(org.id, owner.id, property.id, "cleaning", "500", "2026-06-03");
    await expense(org.id, owner.id, property.id, "cleaning", "700", "2026-06-20");
    await expense(org.id, owner.id, property.id, "renovation", "3000", "2026-06-10", "capital");
    await expense(org.id, owner.id, property.id, "utilities", "900", "2026-07-01");
    const other = await createTestOrg("dash-spend-other");
    const otherProperty = await createTestProperty(other.org.id, other.owner.id);
    await expense(other.org.id, other.owner.id, otherProperty.id, "cleaning", "9999", "2026-06-05");

    expect(await listExpenseTotalsByCategory(org.id, { from: "2026-06-01", to: "2026-07-01" })).toEqual([
      { category: "renovation", amountCents: 300_000 },
      { category: "cleaning", amountCents: 120_000 },
    ]);
  });

  it("returns whole-month summaries oldest first, ending with the given month", async () => {
    const { org, owner } = await createTestOrg("dash-trend");
    const property = await createTestProperty(org.id, owner.id);
    await expense(org.id, owner.id, property.id, "supplies", "250", "2026-05-31");
    await expense(org.id, owner.id, property.id, "supplies", "400", "2026-06-01");

    const trend = await getMonthlyTrend(org.id, "2026-06", 3);
    expect(trend.map((point) => point.month)).toEqual(["2026-04", "2026-05", "2026-06"]);
    expect(trend.map((point) => point.summary.operatingExpensesCents)).toEqual([0, 25_000, 40_000]);
    expect(trend[2]!.summary.from).toBe("2026-06-01");
    expect(trend[2]!.summary.to).toBe("2026-07-01");
  });
});
