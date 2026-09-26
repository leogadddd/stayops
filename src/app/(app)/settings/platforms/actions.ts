"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { assertCan, PermissionError, requireMembership } from "@/lib/auth/session";
import { unexpectedErrorMessage } from "@/lib/errors";
import {
  createPlatform,
  movePlatform,
  PlatformError,
  removePlatform,
  restorePlatform,
  updatePlatform,
  type PlatformInput,
} from "@/server/reservations/platforms";

export interface PlatformFormState {
  error?: string;
  success?: boolean;
}

function toFormError(error: unknown): PlatformFormState {
  if (error instanceof PlatformError || error instanceof PermissionError) return { error: error.message };
  if (error instanceof ZodError) return { error: error.issues[0]?.message ?? "Check the platform details." };
  return { error: unexpectedErrorMessage(error, "platforms") };
}

/** The platform form's fields; commission is typed as a percent ("15" → 1500). */
function platformFromForm(formData: FormData): PlatformInput {
  const read = (key: string) => String(formData.get(key) ?? "").trim();
  const commission = read("commissionPercent").replace(/%$/, "");
  const percent = Number(commission);
  if (commission && !Number.isFinite(percent)) throw new PlatformError("Enter the commission as a percent, like 15.", "commissionPercent");
  return {
    name: read("name"),
    color: read("color"),
    websiteUrl: read("websiteUrl"),
    commissionBasisPoints: commission ? Math.round(percent * 100) : null,
    collectsPayment: read("collectsPayment") === "true",
  };
}

function revalidatePlatforms() {
  revalidatePath("/settings/platforms");
  revalidatePath("/reservations");
  revalidatePath("/reservations/new");
}

export async function createPlatformAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const membership = await requireMembership();
  try {
    assertCan(membership, "platforms.create");
    await createPlatform({ organizationId: membership.organizationId, actorUserId: membership.userId, data: platformFromForm(formData) });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePlatforms();
  return { success: true };
}

export async function updatePlatformAction(platformId: string, _prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const membership = await requireMembership();
  try {
    assertCan(membership, "platforms.update");
    await updatePlatform({ organizationId: membership.organizationId, actorUserId: membership.userId, platformId, data: platformFromForm(formData) });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePlatforms();
  return { success: true };
}

export async function removePlatformAction(platformId: string): Promise<PlatformFormState & { archived?: boolean }> {
  const membership = await requireMembership();
  try {
    assertCan(membership, "platforms.delete");
    const { archived } = await removePlatform({ organizationId: membership.organizationId, actorUserId: membership.userId, platformId });
    revalidatePlatforms();
    return { success: true, archived };
  } catch (error) {
    return toFormError(error);
  }
}

export async function restorePlatformAction(platformId: string): Promise<PlatformFormState> {
  const membership = await requireMembership();
  try {
    assertCan(membership, "platforms.update");
    await restorePlatform({ organizationId: membership.organizationId, actorUserId: membership.userId, platformId });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePlatforms();
  return { success: true };
}

export async function movePlatformAction(platformId: string, direction: "up" | "down"): Promise<PlatformFormState> {
  const membership = await requireMembership();
  try {
    assertCan(membership, "platforms.update");
    await movePlatform({ organizationId: membership.organizationId, actorUserId: membership.userId, platformId, direction });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePlatforms();
  return { success: true };
}
