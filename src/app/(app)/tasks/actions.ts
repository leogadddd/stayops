"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireMembership, assertOwner, PermissionError } from "@/lib/auth/session";
import {
  createDamageReport,
  markTaskReady,
  OperationsError,
  resolveDamageReport,
  setTaskItemCompleted,
  updateTaskNotes,
} from "@/server/operations/service";

export interface TaskFormState {
  error?: string;
  success?: boolean;
}

function readString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function toFormError(error: unknown): TaskFormState {
  if (error instanceof OperationsError) {
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

export async function setTaskItemCompletedAction(
  taskId: string,
  itemId: string,
  completed: boolean,
): Promise<TaskFormState> {
  const membership = await requireMembership();
  try {
    await setTaskItemCompleted({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      taskId,
      itemId,
      completed,
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
  return { success: true };
}

export async function markTaskReadyAction(
  taskId: string,
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const membership = await requireMembership();
  try {
    await markTaskReady({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      actorRole: membership.role,
      taskId,
      data: { overrideReason: readString(formData, "overrideReason") },
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
  return { success: true };
}

export async function updateTaskNotesAction(
  taskId: string,
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const membership = await requireMembership();
  try {
    await updateTaskNotes({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      taskId,
      data: { notes: readString(formData, "notes") },
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath(`/tasks/${taskId}`);
  return { success: true };
}

export interface DamageFormState {
  error?: string;
  success?: boolean;
}

export async function createDamageReportAction(
  unitId: string,
  reservationId: string | undefined,
  _prev: DamageFormState,
  formData: FormData,
): Promise<DamageFormState> {
  const membership = await requireMembership();
  try {
    await createDamageReport({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      unitId,
      reservationId,
      data: {
        description: readString(formData, "description"),
        estimatedAmountPesos: readString(formData, "estimatedAmountPesos"),
        actualAmountPesos: readString(formData, "actualAmountPesos"),
      },
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath("/tasks");
  if (reservationId) revalidatePath(`/reservations/${reservationId}`);
  return { success: true };
}

export async function resolveDamageReportAction(
  damageReportId: string,
  _prev: DamageFormState,
  formData: FormData,
): Promise<DamageFormState> {
  const membership = await requireMembership();
  assertOwner(membership);
  try {
    await resolveDamageReport({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      damageReportId,
      data: {
        resolutionNote: readString(formData, "resolutionNote"),
        actualAmountPesos: readString(formData, "actualAmountPesos"),
      },
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath("/tasks");
  return { success: true };
}
