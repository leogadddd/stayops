"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireMembership, assertOwner, PermissionError } from "@/lib/auth/session";
import { createExpense, ExpenseError } from "@/server/expenses/service";

export interface ExpenseFormState {
  error?: string;
  success?: boolean;
}

function readString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function toFormError(error: unknown): ExpenseFormState {
  if (error instanceof ExpenseError) {
    return { error: error.message };
  }
  if (error instanceof PermissionError) {
    return { error: error.message };
  }
  if (error instanceof ZodError) {
    const first = error.issues[0];
    return { error: first ? first.message : "Check the form and try again." };
  }
  throw error;
}

export async function createExpenseAction(
  _prev: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const membership = await requireMembership();
  assertOwner(membership);
  try {
    await createExpense({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      data: {
        propertyId: readString(formData, "propertyId"),
        unitId: readString(formData, "unitId") || undefined,
        amountPesos: readString(formData, "amountPesos"),
        category: readString(formData, "category"),
        description: readString(formData, "description"),
        classification: readString(formData, "classification"),
        paidDate: readString(formData, "paidDate"),
      },
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath("/expenses");
  return { success: true };
}
