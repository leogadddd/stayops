"use server";

import { revalidatePath } from "next/cache";
import { requireMembership, assertCan, PermissionError } from "@/lib/auth/session";
import { MoneyParseError, pesosToCentavos } from "@/lib/money";
import { WEEKDAYS, type DayRates } from "@/lib/rates";
import {
  updateChecklistTemplate,
  OperationsError,
} from "@/server/operations/service";
import {
  createProperty,
  createUnit,
  deleteProperty,
  deleteUnit,
  getPropertyOrThrow,
  getUnitOrThrow,
  updateProperty,
  updateUnit,
} from "@/server/inventory/service";
import { createAmenity, type AmenityOption } from "@/server/inventory/amenities";
import { AMENITY_SCOPES, UNIT_STATUSES, type AmenityScope, type UnitStatus } from "@/lib/db/schema";
import { InventoryError } from "@/server/inventory/validation";
import { imageUploadFromForm } from "@/server/inventory/image-upload";
import { discardInventoryPhoto, storeInventoryPhoto } from "@/server/inventory/photos";
import { StorageError } from "@/server/storage/service";
import { unexpectedErrorMessage } from "@/lib/errors";

export interface InventoryFormState {
  error?: string;
  success?: boolean;
  /** The record a create action made, so the form can open it. */
  id?: string;
}

function readString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function readOptionalPesos(formData: FormData, key: string): number | null {
  const raw = readString(formData, key);
  if (raw === "") return null;
  return pesosToCentavos(raw);
}

/** Weekday rates from `dayRate-<weekday>` inputs; blank days use the nightly rate. */
function readDayRates(formData: FormData): DayRates {
  const rates: DayRates = {};
  for (const { key } of WEEKDAYS) {
    const cents = readOptionalPesos(formData, `dayRate-${key}`);
    if (cents !== null) rates[key] = cents;
  }
  return rates;
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
  if (error instanceof InventoryError || error instanceof MoneyParseError || error instanceof StorageError) {
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

/**
 * Save a property or unit with the form's cover photo, if one was chosen. The
 * photo goes to object storage first; `save` gets its key (or undefined to keep
 * the current photo). A failed save removes the new photo, and a successful
 * one removes the photo it replaced.
 */
async function saveWithPhoto<T>(
  organizationId: string,
  formData: FormData,
  save: (imageUrl: string | undefined) => Promise<T>,
  previousImageUrl?: () => Promise<string | null>,
): Promise<T> {
  const upload = await imageUploadFromForm(formData, "image");
  const imageUrl = upload ? await storeInventoryPhoto(organizationId, upload) : undefined;
  const previous = imageUrl && previousImageUrl ? await previousImageUrl() : null;
  let result: T;
  try {
    result = await save(imageUrl);
  } catch (error) {
    await discardInventoryPhoto(organizationId, imageUrl);
    throw error;
  }
  if (imageUrl) await discardInventoryPhoto(organizationId, previous);
  return result;
}

export async function createPropertyAction(
  _prev: InventoryFormState,
  formData: FormData,
): Promise<InventoryFormState> {
  const membership = await requireMembership();
  assertCan(membership, "properties.create");
  let property;
  try {
    property = await saveWithPhoto(membership.organizationId, formData, (imageUrl) => createProperty({
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
        imageUrl,
      },
      amenityIds: readAmenityIds(formData),
    }));
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath("/properties");
  revalidatePath("/calendar");
  return { success: true, id: property.id };
}

export async function updatePropertyAction(
  propertyId: string,
  _prev: InventoryFormState,
  formData: FormData,
): Promise<InventoryFormState> {
  const membership = await requireMembership();
  assertCan(membership, "properties.update");
  try {
    await saveWithPhoto(membership.organizationId, formData, (imageUrl) => updateProperty({
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
        imageUrl,
      },
      amenityIds: readAmenityIds(formData),
    }), async () => (await getPropertyOrThrow(membership.organizationId, propertyId)).imageUrl);
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath("/properties");
  revalidatePath("/calendar");
  return { success: true };
}

/** Change only a property's house rules, keeping everything else about it. */
export async function updateHouseRulesAction(
  propertyId: string,
  _prev: InventoryFormState,
  formData: FormData,
): Promise<InventoryFormState> {
  const membership = await requireMembership();
  assertCan(membership, "properties.update");
  try {
    const property = await getPropertyOrThrow(membership.organizationId, propertyId);
    await updateProperty({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      propertyId,
      data: {
        name: property.name,
        address: property.address ?? undefined,
        timezone: property.timezone,
        checkInTime: property.checkInTime,
        checkOutTime: property.checkOutTime,
        turnoverDurationMinutes: property.turnoverDurationMinutes,
        houseRules: readString(formData, "houseRules") || undefined,
      },
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath(`/properties/${propertyId}`);
  return { success: true };
}

export async function deletePropertyAction(
  propertyId: string,
): Promise<InventoryFormState> {
  const membership = await requireMembership();
  assertCan(membership, "properties.delete");
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
  revalidatePath("/properties");
  revalidatePath("/calendar");
  revalidatePath("/calendar/availability");
  return { success: true };
}

function unitDataFromForm(formData: FormData) {
  return {
    name: readString(formData, "name"),
    capacity: Number(readString(formData, "capacity")),
    bedrooms: Number(readString(formData, "bedrooms")),
    bathrooms: Number(readString(formData, "bathrooms")),
    defaultNightlyRateCents: readOptionalPesos(formData, "nightlyRate") ?? 0,
    dayRates: readDayRates(formData),
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
  };
}

export async function createUnitAction(
  propertyId: string,
  _prev: InventoryFormState,
  formData: FormData,
): Promise<InventoryFormState> {
  const membership = await requireMembership();
  assertCan(membership, "properties.create");
  try {
    await saveWithPhoto(membership.organizationId, formData, (imageUrl) => createUnit({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      propertyId,
      data: { ...unitDataFromForm(formData), imageUrl },
      amenityIds: readAmenityIds(formData),
    }));
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath(`/properties/${propertyId}`);
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
  assertCan(membership, "properties.update");
  try {
    await saveWithPhoto(membership.organizationId, formData, (imageUrl) => updateUnit({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      unitId,
      data: { ...unitDataFromForm(formData), imageUrl },
      amenityIds: readAmenityIds(formData),
    }), async () => (await getUnitOrThrow(membership.organizationId, unitId)).imageUrl);
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath(`/properties/${propertyId}/units/${unitId}`);
  revalidatePath("/calendar");
  return { success: true };
}

/** Change only a unit's status, keeping everything else about it. */
export async function updateUnitStatusAction(
  propertyId: string,
  unitId: string,
  _prev: InventoryFormState,
  formData: FormData,
): Promise<InventoryFormState> {
  const membership = await requireMembership();
  assertCan(membership, "properties.update");
  const status = readString(formData, "status") as UnitStatus;
  try {
    if (!UNIT_STATUSES.includes(status)) {
      throw new InventoryError("Choose a status.", "status");
    }
    const unit = await getUnitOrThrow(membership.organizationId, unitId);
    if (unit.propertyId !== propertyId) throw new InventoryError("Unit not found.", "unitId");
    if (unit.status !== status) {
      await updateUnit({
        organizationId: membership.organizationId,
        actorUserId: membership.userId,
        unitId,
        data: {
          name: unit.name,
          capacity: unit.capacity,
          bedrooms: unit.bedrooms,
          bathrooms: unit.bathrooms,
          defaultNightlyRateCents: unit.defaultNightlyRateCents,
          cleaningFeeCents: unit.cleaningFeeCents,
          securityDepositCents: unit.securityDepositCents,
          checkInTime: unit.checkInTime,
          checkOutTime: unit.checkOutTime,
          status,
        },
      });
    }
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath("/dashboard");
  revalidatePath("/properties");
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath(`/properties/${propertyId}/units/${unitId}`);
  revalidatePath("/calendar");
  revalidatePath("/reservations/new");
  return { success: true };
}

export async function deleteUnitAction(
  propertyId: string,
  unitId: string,
): Promise<InventoryFormState> {
  const membership = await requireMembership();
  assertCan(membership, "properties.delete");
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
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath("/properties");
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
  assertCan(membership, "properties.update");
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
  revalidatePath(`/properties/${propertyId}/units/${unitId}`);
  revalidatePath("/tasks");
  return { success: true };
}

export async function createAmenityAction(
  scope: AmenityScope,
  name: string,
): Promise<{ amenity?: AmenityOption; error?: string }> {
  const membership = await requireMembership();
  assertCan(membership, "properties.update");
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
