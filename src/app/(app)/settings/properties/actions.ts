"use server";

import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/auth/session";
import { MoneyParseError, pesosToCentavos } from "@/lib/money";
import {
  updateChecklistTemplate,
  OperationsError,
} from "@/server/operations/service";
import {
  createProperty,
  createUnit,
  updateProperty,
  updateUnit,
} from "@/server/inventory/service";
import { InventoryError } from "@/server/inventory/validation";

export interface InventoryFormState {
  error?: string;
  success?: boolean;
}

function readString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function readOptionalPesos(formData: FormData, key: string): number | null {
  const raw = readString(formData, key);
  if (raw === "") return null;
  return pesosToCentavos(raw);
}

function toFormError(error: unknown): InventoryFormState {
  if (error instanceof InventoryError || error instanceof MoneyParseError) {
    return { error: error.message };
  }
  if (error instanceof OperationsError) {
    return { error: error.message };
  }
  throw error;
}

export async function createPropertyAction(
  _prev: InventoryFormState,
  formData: FormData,
): Promise<InventoryFormState> {
  const membership = await requireMembership();
  try {
    await createProperty({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      data: {
        name: readString(formData, "name"),
        address: readString(formData, "address") || undefined,
        timezone: readString(formData, "timezone") || "Asia/Manila",
        checkInTime: readString(formData, "checkInTime") || "15:00",
        checkOutTime: readString(formData, "checkOutTime") || "11:00",
        houseRules: readString(formData, "houseRules") || undefined,
      },
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath("/settings/properties");
  revalidatePath("/calendar");
  return { success: true };
}

export async function updatePropertyAction(
  propertyId: string,
  _prev: InventoryFormState,
  formData: FormData,
): Promise<InventoryFormState> {
  const membership = await requireMembership();
  try {
    await updateProperty({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      propertyId,
      data: {
        name: readString(formData, "name"),
        address: readString(formData, "address") || undefined,
        timezone: readString(formData, "timezone") || "Asia/Manila",
        checkInTime: readString(formData, "checkInTime") || "15:00",
        checkOutTime: readString(formData, "checkOutTime") || "11:00",
        houseRules: readString(formData, "houseRules") || undefined,
      },
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath("/settings/properties");
  revalidatePath("/calendar");
  return { success: true };
}

function unitDataFromForm(formData: FormData) {
  return {
    name: readString(formData, "name"),
    capacity: Number(readString(formData, "capacity")),
    bedrooms: Number(readString(formData, "bedrooms")),
    bathrooms: Number(readString(formData, "bathrooms")),
    defaultNightlyRateCents: readOptionalPesos(formData, "nightlyRate") ?? 0,
    cleaningFeeCents: readOptionalPesos(formData, "cleaningFee"),
    securityDepositCents: readOptionalPesos(formData, "securityDeposit"),
    status: readString(formData, "status") as
      | "renovating"
      | "furnishing"
      | "ready_to_list"
      | "active"
      | "maintenance"
      | "inactive",
  };
}

export async function createUnitAction(
  propertyId: string,
  _prev: InventoryFormState,
  formData: FormData,
): Promise<InventoryFormState> {
  const membership = await requireMembership();
  try {
    await createUnit({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      propertyId,
      data: unitDataFromForm(formData),
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath(`/settings/properties/${propertyId}`);
  revalidatePath("/calendar");
  return { success: true };
}

export async function updateUnitAction(
  propertyId: string,
  unitId: string,
  _prev: InventoryFormState,
  formData: FormData,
): Promise<InventoryFormState> {
  const membership = await requireMembership();
  try {
    await updateUnit({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      unitId,
      data: unitDataFromForm(formData),
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath(`/settings/properties/${propertyId}`);
  revalidatePath(`/settings/properties/${propertyId}/units/${unitId}`);
  revalidatePath("/calendar");
  return { success: true };
}

export async function updateChecklistTemplateAction(
  propertyId: string,
  unitId: string,
  _prev: InventoryFormState,
  formData: FormData,
): Promise<InventoryFormState> {
  const membership = await requireMembership();
  let items: unknown;
  try {
    items = JSON.parse(readString(formData, "templateJson") || "[]");
  } catch {
    return { error: "The checklist could not be read. Refresh and try again." };
  }
  try {
    await updateChecklistTemplate({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      unitId,
      data: items,
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath(`/settings/properties/${propertyId}/units/${unitId}`);
  revalidatePath("/tasks");
  return { success: true };
}