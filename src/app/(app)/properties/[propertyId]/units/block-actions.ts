"use server";

import { revalidatePath } from "next/cache";
import { requireMembership, assertOwner, PermissionError } from "@/lib/auth/session";
import { z } from "zod";
import {
  addUnitBlock,
  removeUnitBlock,
  updateUnitBlock,
} from "@/server/inventory/service";
import { InventoryError } from "@/server/inventory/validation";
import { unexpectedErrorMessage } from "@/lib/errors";

export interface BlockFormState {
  error?: string;
  success?: boolean;
}

export async function addUnitBlockAction(
  propertyId: string,
  unitId: string,
  _prev: BlockFormState,
  formData: FormData,
): Promise<BlockFormState> {
  const membership = await requireMembership();
  assertOwner(membership);
  try {
    await addUnitBlock({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      unitId,
      data: blockDataFromForm(formData),
    });
  } catch (error) {
    return toBlockFormError(error);
  }
  revalidatePath(`/properties/${propertyId}/units/${unitId}`);
  revalidatePath("/calendar");
  return { success: true };
}

export async function updateUnitBlockAction(
  propertyId: string,
  unitId: string,
  blockId: string,
  _prev: BlockFormState,
  formData: FormData,
): Promise<BlockFormState> {
  const membership = await requireMembership();
  assertOwner(membership);
  try {
    await updateUnitBlock({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      unitId,
      blockId,
      data: blockDataFromForm(formData),
    });
  } catch (error) {
    return toBlockFormError(error);
  }
  revalidatePath(`/properties/${propertyId}/units/${unitId}`);
  revalidatePath("/calendar");
  return { success: true };
}

function blockDataFromForm(formData: FormData) {
  return {
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    reason: String(formData.get("reason") ?? "").trim(),
  };
}

function toBlockFormError(error: unknown): BlockFormState {
  if (error instanceof InventoryError || error instanceof PermissionError) {
    return { error: error.message };
  }
  if (error instanceof z.ZodError) {
    return { error: error.issues[0]?.message ?? "Check the block details." };
  }
  return { error: unexpectedErrorMessage(error, "unit-blocks") };
}

export async function removeUnitBlockAction(
  propertyId: string,
  unitId: string,
  blockId: string,
): Promise<void> {
  const membership = await requireMembership();
  assertOwner(membership);
  await removeUnitBlock({
    organizationId: membership.organizationId,
    actorUserId: membership.userId,
    blockId,
  });
  revalidatePath(`/properties/${propertyId}/units/${unitId}`);
  revalidatePath("/calendar");
}
