"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireMembership } from "@/lib/auth/session";
import {
  cancelReservation,
  confirmHold,
  createConfirmed,
  createHold,
} from "@/server/reservations/service";
import {
  createGuestLink,
  revokeGuestLink,
} from "@/server/reservations/guest-link";
import { ReservationError } from "@/server/reservations/validation";
import type { ChargeLineInput } from "@/server/reservations/validation";

export interface ReservationFormState {
  error?: string;
  success?: boolean;
  reservationId?: string;
}

function readString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function toFormError(error: unknown): ReservationFormState {
  if (error instanceof ReservationError) {
    return { error: error.message };
  }
  if (error instanceof ZodError) {
    const first = error.issues[0];
    return { error: first ? first.message : "Check the form and try again." };
  }
  if (error instanceof SyntaxError) {
    return { error: "The charge breakdown could not be read. Refresh and try again." };
  }
  throw error;
}

function readCharges(formData: FormData): unknown {
  return JSON.parse(readString(formData, "chargesJson") || "[]");
}

// The service re-validates every line with chargeLineSchema before writing;
// this cast only bridges the JSON boundary of the form.
function readChargeLines(formData: FormData): ChargeLineInput[] {
  return readCharges(formData) as ChargeLineInput[];
}

export async function createReservationAction(
  _prev: ReservationFormState,
  formData: FormData,
): Promise<ReservationFormState> {
  const membership = await requireMembership();
  const mode = readString(formData, "mode") === "confirmed" ? "confirmed" : "hold";

  const guestMode = readString(formData, "guestMode") === "new" ? "new" : "existing";
  const guest =
    guestMode === "new"
      ? {
          newGuest: {
            name: readString(formData, "guestName"),
            email: readString(formData, "guestEmail") || undefined,
            phone: readString(formData, "guestPhone") || undefined,
            notes: readString(formData, "guestNotes") || undefined,
          },
        }
      : { guestId: readString(formData, "guestId") };

  const base = {
    unitId: readString(formData, "unitId"),
    checkIn: readString(formData, "checkIn"),
    checkOut: readString(formData, "checkOut"),
    guestCount: Number(readString(formData, "guestCount") || "1"),
    charges: readChargeLines(formData),
  };

  try {
    const idempotencyKey = readString(formData, "idempotencyKey") || undefined;
    const reservation =
      mode === "hold"
        ? await createHold({
            organizationId: membership.organizationId,
            actorUserId: membership.userId,
            guest,
            idempotencyKey,
            data: {
              ...base,
              holdMinutes: Number(
                readString(formData, "holdMinutes") || "1440",
              ),
            },
          })
        : await createConfirmed({
            organizationId: membership.organizationId,
            actorUserId: membership.userId,
            guest,
            idempotencyKey,
            data: {
              ...base,
              acknowledgeUnpaid:
                formData.get("acknowledgeUnpaid") === "on",
            },
          });

    revalidatePath("/calendar");
    revalidatePath("/reservations");
    return { success: true, reservationId: reservation.id };
  } catch (error) {
    return toFormError(error);
  }
}

export async function confirmHoldAction(
  reservationId: string,
  _prev: ReservationFormState,
  formData: FormData,
): Promise<ReservationFormState> {
  const membership = await requireMembership();
  try {
    await confirmHold({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      reservationId,
      reason: readString(formData, "reason"),
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath(`/reservations/${reservationId}`);
  revalidatePath("/calendar");
  return { success: true };
}

export async function cancelReservationAction(
  reservationId: string,
  _prev: ReservationFormState,
  formData: FormData,
): Promise<ReservationFormState> {
  const membership = await requireMembership();
  try {
    await cancelReservation({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      reservationId,
      reason: readString(formData, "reason"),
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath(`/reservations/${reservationId}`);
  revalidatePath("/reservations");
  revalidatePath("/calendar");
  return { success: true };
}

export interface GuestLinkFormState {
  error?: string;
  token?: string;
  tokenId?: string;
  rotated?: boolean;
}

export async function createGuestLinkAction(
  reservationId: string,
  _prev: GuestLinkFormState,
  _formData: FormData,
): Promise<GuestLinkFormState> {
  const membership = await requireMembership();
  try {
    const link = await createGuestLink({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      reservationId,
    });
    revalidatePath(`/reservations/${reservationId}`);
    return { token: link.token, tokenId: link.tokenId };
  } catch (error) {
    if (error instanceof ReservationError) {
      return { error: error.message };
    }
    throw error;
  }
}

export async function revokeGuestLinkAction(
  reservationId: string,
  tokenId: string,
  _prev: GuestLinkFormState,
  _formData: FormData,
): Promise<GuestLinkFormState> {
  const membership = await requireMembership();
  try {
    await revokeGuestLink({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      tokenId,
    });
  } catch (error) {
    if (error instanceof ReservationError) {
      return { error: error.message };
    }
    throw error;
  }
  revalidatePath(`/reservations/${reservationId}`);
  return {};
}
