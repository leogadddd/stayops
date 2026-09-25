import "server-only";

import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditEvents, expenses, properties, units } from "@/lib/db/schema";
import { isValidMonth, monthNightRange } from "@/lib/dates";
import { MoneyParseError, pesosToCentavos } from "@/lib/money";
import { createExpenseSchema } from "../payments/validation";

export class ExpenseError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "ExpenseError";
  }
}

export interface ExpenseListItem {
  id: string;
  propertyId: string;
  propertyName: string;
  unitId: string | null;
  unitName: string | null;
  amountCents: number;
  category: string;
  description: string;
  classification: "operating" | "capital";
  paidDate: string;
  createdAt: Date;
}

export async function listExpenses(
  organizationId: string,
  filters: { propertyId?: string; classification?: string; month?: string } = {},
): Promise<ExpenseListItem[]> {
  const conditions = [eq(expenses.organizationId, organizationId)];
  if (filters.propertyId) {
    conditions.push(eq(expenses.propertyId, filters.propertyId));
  }
  if (
    filters.classification === "operating" ||
    filters.classification === "capital"
  ) {
    conditions.push(eq(expenses.classification, filters.classification));
  }
  if (filters.month && isValidMonth(filters.month)) {
    const range = monthNightRange(filters.month);
    conditions.push(gte(expenses.paidDate, range.start));
    conditions.push(lt(expenses.paidDate, range.end));
  }

  return db
    .select({
      id: expenses.id,
      propertyId: expenses.propertyId,
      propertyName: properties.name,
      unitId: expenses.unitId,
      unitName: units.name,
      amountCents: expenses.amountCents,
      category: expenses.category,
      description: expenses.description,
      classification: expenses.classification,
      paidDate: expenses.paidDate,
      createdAt: expenses.createdAt,
    })
    .from(expenses)
    .innerJoin(
      properties,
      and(
        eq(expenses.propertyId, properties.id),
        eq(expenses.organizationId, properties.organizationId),
      ),
    )
    .leftJoin(
      units,
      and(
        eq(expenses.unitId, units.id),
        eq(expenses.organizationId, units.organizationId),
      ),
    )
    .where(and(...conditions))
    .orderBy(desc(expenses.paidDate), desc(expenses.createdAt));
}

/** Expense totals per category paid in [from, to), largest first. */
export async function listExpenseTotalsByCategory(
  organizationId: string,
  range: { from: string; to: string },
): Promise<{ category: string; amountCents: number }[]> {
  const total = sql`sum(${expenses.amountCents})`.mapWith(Number);
  return db
    .select({ category: expenses.category, amountCents: total })
    .from(expenses)
    .where(
      and(
        eq(expenses.organizationId, organizationId),
        gte(expenses.paidDate, range.from),
        lt(expenses.paidDate, range.to),
      ),
    )
    .groupBy(expenses.category)
    .orderBy(desc(total));
}

export async function createExpense(input: {
  organizationId: string;
  actorUserId: string;
  data: unknown;
}) {
  const data = createExpenseSchema.parse(input.data);
  let amountCents: number;
  try {
    amountCents = pesosToCentavos(data.amountPesos, { allowZero: false });
  } catch (error) {
    if (error instanceof MoneyParseError) {
      throw new ExpenseError(error.message, "amountPesos");
    }
    throw error;
  }

  return db.transaction(async (tx) => {
    const [property] = await tx
      .select({ id: properties.id })
      .from(properties)
      .where(
        and(
          eq(properties.id, data.propertyId),
          eq(properties.organizationId, input.organizationId),
        ),
      )
      .limit(1);
    if (!property) {
      throw new ExpenseError("Property not found.", "propertyId");
    }

    if (data.unitId) {
      const [unit] = await tx
        .select({ id: units.id })
        .from(units)
        .where(
          and(
            eq(units.id, data.unitId),
            eq(units.organizationId, input.organizationId),
            eq(units.propertyId, data.propertyId),
          ),
        )
        .limit(1);
      if (!unit) {
        throw new ExpenseError(
          "That unit does not belong to the chosen property.",
          "unitId",
        );
      }
    }

    const [entry] = await tx
      .insert(expenses)
      .values({
        organizationId: input.organizationId,
        propertyId: data.propertyId,
        unitId: data.unitId ?? null,
        amountCents,
        category: data.category,
        description: data.description,
        classification: data.classification,
        paidDate: data.paidDate,
        createdBy: input.actorUserId,
      })
      .returning();
    if (!entry) {
      throw new ExpenseError("Failed to record the expense.");
    }

    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "expense",
      entityId: entry.id,
      action: "expense.created",
      metadata: {
        propertyId: data.propertyId,
        unitId: data.unitId ?? null,
        amountCents,
        category: data.category,
        classification: data.classification,
      },
    });
    return entry;
  });
}
