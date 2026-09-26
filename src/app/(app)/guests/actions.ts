"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireMembership, assertCan, PermissionError } from "@/lib/auth/session";
import { createGuest, deleteGuest, updateGuest } from "@/server/reservations/service";
import { ReservationError, type GuestProfileInput } from "@/server/reservations/validation";
import { parseGuestTags, type GuestIdType } from "@/lib/guests";
import { unexpectedErrorMessage } from "@/lib/errors";

export interface GuestFormState {
  error?: string;
  success?: boolean;
  /** The guest a create action made, so the form can open it. */
  id?: string;
}

function readString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function readGuest(formData: FormData): GuestProfileInput {
  const optional = (key: string) => readString(formData, key) || undefined;
  return {
    name: readString(formData, "name"),
    email: optional("email"),
    phone: optional("phone"),
    notes: optional("notes"),
    preferredName: optional("preferredName"),
    birthDate: optional("birthDate"),
    nationality: optional("nationality"),
    // The schema rejects anything outside GUEST_ID_TYPES.
    idType: optional("idType") as GuestIdType | undefined,
    idNumber: optional("idNumber"),
    address: optional("address"),
    company: optional("company"),
    tin: optional("tin"),
    emergencyContactName: optional("emergencyContactName"),
    emergencyContactPhone: optional("emergencyContactPhone"),
    tags: parseGuestTags(readString(formData, "tags")),
    flagged: formData.get("flagged") === "on",
    flagReason: optional("flagReason"),
    marketingOptIn: formData.get("marketingOptIn") === "on",
  };
}

function toFormError(error: unknown): GuestFormState {
  if (error instanceof ReservationError || error instanceof PermissionError) return { error: error.message };
  if (error instanceof ZodError) return { error: error.issues[0]?.message ?? "Check the form and try again." };
  return { error: unexpectedErrorMessage(error, "guests") };
}

export async function createGuestAction(_prev: GuestFormState, formData: FormData): Promise<GuestFormState> {
  const membership = await requireMembership();
  let guest;
  try {
    assertCan(membership, "guests.create");
    guest = await createGuest({ organizationId: membership.organizationId, actorUserId: membership.userId, data: readGuest(formData) });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath("/guests");
  return { success: true, id: guest.id };
}

export async function updateGuestAction(guestId: string, _prev: GuestFormState, formData: FormData): Promise<GuestFormState> {
  const membership = await requireMembership();
  try {
    assertCan(membership, "guests.update");
    await updateGuest({ organizationId: membership.organizationId, actorUserId: membership.userId, guestId, data: readGuest(formData) });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath("/guests");
  revalidatePath(`/guests/${guestId}`);
  // Guest names show on reservations and the calendar.
  revalidatePath("/reservations");
  revalidatePath("/calendar");
  return { success: true, id: guestId };
}

export async function deleteGuestAction(guestId: string): Promise<GuestFormState> {
  const membership = await requireMembership();
  try {
    assertCan(membership, "guests.delete");
    await deleteGuest({ organizationId: membership.organizationId, actorUserId: membership.userId, guestId });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath("/guests");
  return { success: true };
}

export interface QuickGuestState {
  error?: string;
  guest?: { id: string; name: string; email: string | null; phone: string | null };
}

/**
 * Create a guest from the reservation flow's "New guest" dialog. Unlike the
 * Guests page, the booking needs both an email and a phone to reach them.
 */
export async function createGuestForBookingAction(_prev: QuickGuestState, formData: FormData): Promise<QuickGuestState> {
  const membership = await requireMembership();
  const data = readGuest(formData);
  if (!data.email) return { error: "Add the guest's email." };
  if (!data.phone) return { error: "Add the guest's phone number." };
  try {
    assertCan(membership, "guests.create");
    const guest = await createGuest({ organizationId: membership.organizationId, actorUserId: membership.userId, data });
    revalidatePath("/guests");
    return { guest: { id: guest.id, name: guest.name, email: guest.email, phone: guest.phone } };
  } catch (error) {
    return toFormError(error);
  }
}
