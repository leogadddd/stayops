"use server";

import { revalidatePath } from "next/cache";
import { requireMembership, assertOwner, PermissionError } from "@/lib/auth/session";
import { MoneyParseError, pesosToCentavos } from "@/lib/money";
import {
  updateChecklistTemplate,
  OperationsError,
} from "@/server/operations/service";
import {
  createProperty,
  createUnit,
  deleteProperty,
  deleteUnit,
  updateProperty,
  updateUnit,
} from "@/server/inventory/service";
import { createAmenity, type AmenityOption } from "@/server/inventory/amenities";
import { AMENITY_SCOPES, type AmenityScope } from "@/lib/db/schema";
import { InventoryError } from "@/server/inventory/validation";
import { imageDataUrlFromForm } from "@/server/inventory/image-upload";
import { unexpectedErrorMessage } from "@/lib/errors";

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

function readTurnoverDuration(formData: FormData): number {
  const hours = Number(readString(formData, "turnoverHours") || "0");
  const minutes = Number(readString(formData, "turnoverMinutes") || "0");
  return hours * 60 + minutes;
}

function readAmenityIds(formData: FormData): string[] {
  return formData.getAll("amenityId").map((value) => String(value)).filter(Boolean);
}

function toFormError(error: unknown): InventoryFormState {
  if (error instanceof InventoryError || error instanceof MoneyParseError) {
    return { error: error.message };
  }
  if (error instanceof OperationsError) {
    return { error: error.message };
  }
  if (error instanceof PermissionError) {
    return { error: error.message };
  }
  return { error: unexpectedErrorMessage(error, "inventory") };
}

export async function createPropertyAction(
  _prev: InventoryFormState,
  formData: FormData,
): Promise<InventoryFormState> {
  const membership = await requireMembership();
  assertOwner(membership);
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
        turnoverDurationMinutes: readTurnoverDuration(formData),
        houseRules: readString(formData, "houseRules") || undefined,
        imageUrl: await imageDataUrlFromForm(formData, "image"),
      },
      amenityIds: readAmenityIds(formData),
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
  assertOwner(membership);
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
        turnoverDurationMinutes: readTurnoverDuration(formData),
        houseRules: readString(formData, "houseRules") || undefined,
        imageUrl: await imageDataUrlFromForm(formData, "image"),
      },
      amenityIds: readAmenityIds(formData),
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath("/settings/properties");
  revalidatePath("/calendar");
  return { success: true };
}

export async function deletePropertyAction(
  propertyId: string,
): Promise<InventoryFormState> {
  const membership = await requireMembership();
  assertOwner(membership);
  try {
    await deleteProperty({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      propertyId,
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath("/dashboard");
  revalidatePath("/settings/properties");
  revalidatePath("/calendar");
  revalidatePath("/calendar/availability");
  return { success: true };
}

async function unitDataFromForm(formData: FormData) {
  return {
    name: readString(formData, "name"),
    capacity: Number(readString(formData, "capacity")),
    bedrooms: Number(readString(formData, "bedrooms")),
    bathrooms: Number(readString(formData, "bathrooms")),
    defaultNightlyRateCents: readOptionalPesos(formData, "nightlyRate") ?? 0,
    cleaningFeeCents: readOptionalPesos(formData, "cleaningFee"),
    securityDepositCents: readOptionalPesos(formData, "securityDeposit"),
    checkInTime: readString(formData, "checkInTime") || "15:00",
    checkOutTime: readString(formData, "checkOutTime") || "11:00",
    status: readString(formData, "status") as
      | "renovating"
      | "furnishing"
      | "ready_to_list"
      | "active"
      | "maintenance"
      | "inactive",
    imageUrl: await imageDataUrlFromForm(formData, "image"),
  };
}

export async function createUnitAction(
  propertyId: string,
  _prev: InventoryFormState,
  formData: FormData,
): Promise<InventoryFormState> {
  const membership = await requireMembership();
  assertOwner(membership);
  try {
    await createUnit({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      propertyId,
      data: await unitDataFromForm(formData),
      amenityIds: readAmenityIds(formData),
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
  assertOwner(membership);
  try {
    await updateUnit({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      unitId,
      data: await unitDataFromForm(formData),
      amenityIds: readAmenityIds(formData),
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath(`/settings/properties/${propertyId}`);
  revalidatePath(`/settings/properties/${propertyId}/units/${unitId}`);
  revalidatePath("/calendar");
  return { success: true };
}

export async function deleteUnitAction(
  propertyId: string,
  unitId: string,
): Promise<InventoryFormState> {
  const membership = await requireMembership();
  assertOwner(membership);
  try {
    await deleteUnit({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      unitId,
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath("/dashboard");
  revalidatePath(`/settings/properties/${propertyId}`);
  revalidatePath("/settings/properties");
  revalidatePath("/calendar");
  revalidatePath("/calendar/availability");
  return { success: true };
}

export async function updateChecklistTemplateAction(
  propertyId: string,
  unitId: string,
  _prev: InventoryFormState,
  formData: FormData,
): Promise<InventoryFormState> {
  const membership = await requireMembership();
  assertOwner(membership);
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

export async function createAmenityAction(
  scope: AmenityScope,
  name: string,
): Promise<{ amenity?: AmenityOption; error?: string }> {
  const membership = await requireMembership();
  assertOwner(membership);
  if (!AMENITY_SCOPES.includes(scope)) return { error: "Choose a property or unit amenity." };
  try {
    const amenity = await createAmenity({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      scope,
      name,
    });
    return { amenity };
  } catch (error) {
    return toFormError(error);
  }
}
