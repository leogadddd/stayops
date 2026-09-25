"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import {
  assertOwner,
  PermissionError,
  requireMembership,
  requireUser,
} from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { unexpectedErrorMessage } from "@/lib/errors";
import {
  createProperty,
  createUnit,
  updateProperty,
  updateUnit,
} from "@/server/inventory/service";
import { InventoryError } from "@/server/inventory/validation";
import { createOrganization, OrgError, updateOrganizationName } from "@/server/orgs/service";
import { getOnboardingState } from "./state";

export interface OnboardingFormState {
  error?: string;
  success?: boolean;
}

const DEFAULT_TIMEZONE = "Asia/Manila";

function readString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function toFormError(error: unknown): OnboardingFormState {
  if (
    error instanceof OrgError ||
    error instanceof InventoryError ||
    error instanceof PermissionError
  ) {
    return { error: error.message };
  }
  if (error instanceof ZodError) {
    return { error: error.issues[0]?.message ?? "Check the form and try again." };
  }
  return { error: unexpectedErrorMessage(error, "onboarding") };
}

/** Step 1: create the organization from its business name, or rename it on a revisit. */
export async function saveOrganizationAction(
  _prev: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const user = await requireUser();
  const name = readString(formData, "name");
  try {
    const { membership } = await getOnboardingState(user.id);
    if (!membership) {
      await createOrganization({ name, ownerUserId: user.id });
    } else if (membership.role === "owner" && membership.organizationName !== name) {
      await updateOrganizationName({
        organizationId: membership.organizationId,
        actorUserId: user.id,
        name,
      });
    }
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Step 2: the first property, from its name and address. A new one starts with
 * the organization's timezone and the usual 15:00 / 11:00 times; a revisit
 * only changes the name and address.
 */
export async function saveFirstPropertyAction(
  _prev: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const membership = await requireMembership();
  const name = readString(formData, "name");
  const address = readString(formData, "address") || undefined;
  try {
    assertOwner(membership);
    const { property } = await getOnboardingState(membership.userId);
    if (property) {
      await updateProperty({
        organizationId: membership.organizationId,
        actorUserId: membership.userId,
        propertyId: property.id,
        data: {
          name,
          address,
          timezone: property.timezone,
          checkInTime: property.checkInTime,
          checkOutTime: property.checkOutTime,
          turnoverDurationMinutes: property.turnoverDurationMinutes,
          houseRules: property.houseRules ?? undefined,
        },
      });
    } else {
      const organization = await db.query.organizations.findFirst({
        columns: { defaultTimezone: true },
        where: eq(organizations.id, membership.organizationId),
      });
      await createProperty({
        organizationId: membership.organizationId,
        actorUserId: membership.userId,
        data: {
          name,
          address,
          timezone: organization?.defaultTimezone ?? DEFAULT_TIMEZONE,
          checkInTime: "15:00",
          checkOutTime: "11:00",
        },
      });
    }
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/properties");
  return { success: true };
}

/**
 * Step 3: the property's first unit, from its name. A new unit starts active so
 * the dashboard outlook, calendar and new-reservation form can use it right
 * away; guests, rooms and rates are filled in later from Properties. A revisit
 * only renames it.
 */
export async function saveFirstUnitAction(
  _prev: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const membership = await requireMembership();
  const name = readString(formData, "name");
  try {
    assertOwner(membership);
    const { property, unit } = await getOnboardingState(membership.userId);
    if (!property) return { error: "Add a property first." };
    if (unit) {
      await updateUnit({
        organizationId: membership.organizationId,
        actorUserId: membership.userId,
        unitId: unit.id,
        data: {
          name,
          capacity: unit.capacity,
          bedrooms: unit.bedrooms,
          bathrooms: unit.bathrooms,
          defaultNightlyRateCents: unit.defaultNightlyRateCents,
          cleaningFeeCents: unit.cleaningFeeCents,
          securityDepositCents: unit.securityDepositCents,
          checkInTime: unit.checkInTime,
          checkOutTime: unit.checkOutTime,
          status: unit.status,
        },
      });
    } else {
      await createUnit({
        organizationId: membership.organizationId,
        actorUserId: membership.userId,
        propertyId: property.id,
        data: {
          name,
          capacity: 2,
          bedrooms: 1,
          bathrooms: 1,
          defaultNightlyRateCents: 0,
          cleaningFeeCents: null,
          securityDepositCents: null,
          checkInTime: property.checkInTime,
          checkOutTime: property.checkOutTime,
          status: "active",
        },
      });
    }
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/properties");
  revalidatePath("/reservations/new");
  return { success: true };
}
