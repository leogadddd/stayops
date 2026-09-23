"use server";

import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/auth/session";
import { z } from "zod";
import {
  addUnitBlock,
  removeUnitBlock,
} from "@/server/inventory/service";
import { InventoryError } from "@/server/inventory/validation";

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
  try {
    await addUnitBlock({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      unitId,
      data: {
        startDate: String(formData.get("startDate") ?? ""),
        endDate: String(formData.get("endDate") ?? ""),
        reason: String(formData.get("reason") ?? "").trim(),
      },
    });
  } catch (error) {
    if (error instanceof InventoryError) {
      return { error: error.message };
    }
    if (error instanceof z.ZodError) {
      return { error: error.issues[0]?.message ?? "Check the block details." };
    }
    throw error;
  }
  revalidatePath(`/settings/properties/${propertyId}/units/${unitId}`);
  revalidatePath("/calendar");
  return { success: true };
}

export async function removeUnitBlockAction(
  propertyId: string,
  unitId: string,
  blockId: string,
): Promise<void> {
  const membership = await requireMembership();
  await removeUnitBlock({
    organizationId: membership.organizationId,
    actorUserId: membership.userId,
    blockId,
  });
  revalidatePath(`/settings/properties/${propertyId}/units/${unitId}`);
  revalidatePath("/calendar");
}
