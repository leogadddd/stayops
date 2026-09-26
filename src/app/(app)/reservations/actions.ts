"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireMembership, assertOwner, PermissionError } from "@/lib/auth/session";
import {
  cancelReservation,
  confirmHold,
  createConfirmed,
  createHold,
  updateReservation,
} from "@/server/reservations/service";
import {
  createGuestLink,
  revokeGuestLink,
} from "@/server/reservations/guest-link";
import {
  checkIn,
  checkOut,
  OperationsError,
} from "@/server/operations/service";
import { ReservationError, reservationDetailsSchema } from "@/server/reservations/validation";
import { getUnitOrThrow } from "@/server/inventory/service";
import { InventoryError } from "@/server/inventory/validation";
import { buildDefaultCharges } from "@/lib/charges";
import { nightsBetween } from "@/lib/dates";
import { MoneyParseError, pesosToCentavos } from "@/lib/money";
import type { ChargeLineInput } from "@/server/reservations/validation";
import { unexpectedErrorMessage } from "@/lib/errors";

export interface ReservationFormState {
  error?: string;
  success?: boolean;
  reservationId?: string;
}

function readString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function toFormError(error: unknown): ReservationFormState {
  if (error instanceof ReservationError || error instanceof InventoryError || error instanceof MoneyParseError) {
    return { error: error.message };
  }
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
  if (error instanceof SyntaxError) {
    return { error: "The charge breakdown could not be read. Refresh and try again." };
  }
  return { error: unexpectedErrorMessage(error, "reservations") };
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
  if (mode === "confirmed") {
    assertOwner(membership);
  }

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

  try {
    const details = reservationDetailsSchema.parse({
      unitId: readString(formData, "unitId"),
      checkIn: readString(formData, "checkIn"),
      checkOut: readString(formData, "checkOut"),
      guestCount: Number(readString(formData, "guestCount") || "1"),
    });
    if (details.checkOut <= details.checkIn) {
      throw new ReservationError("Check-out must be after check-in.", "checkOut");
    }
    let charges: ChargeLineInput[];
    if (membership.role === "owner") {
      charges = readChargeLines(formData);
    } else {
      const unit = await getUnitOrThrow(membership.organizationId, details.unitId);
      charges = buildDefaultCharges({
        nightlyRateCents: unit.defaultNightlyRateCents,
        dayRates: unit.dayRates,
        checkIn: details.checkIn,
        cleaningFeeCents: unit.cleaningFeeCents,
        securityDepositCents: unit.securityDepositCents,
        nights: nightsBetween(details.checkIn, details.checkOut),
      });
    }
    const base = { ...details, charges };
    const occupantNames = formData
      .getAll("occupantName")
      .map((value) => String(value).trim());
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
              occupantNames,
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
              occupantNames,
              acknowledgeUnpaid:
                formData.get("acknowledgeUnpaid") === "on",
              initialPayment: readString(formData, "paymentAmountPesos")
                ? {
                    amountPesos: readString(formData, "paymentAmountPesos"),
                    allocation: readString(formData, "paymentAllocation") as "booking" | "security_deposit",
                    method: readString(formData, "paymentMethod") as "gcash" | "maya" | "bank_transfer" | "cash",
                    reference: readString(formData, "paymentReference") || undefined,
                    receivedAt: readString(formData, "paymentReceivedAt") || undefined,
                  }
                : undefined,
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
  assertOwner(membership);
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
  assertOwner(membership);
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

export async function quickCancelReservationAction(reservationId: string): Promise<ReservationFormState> {
  const membership = await requireMembership();
  assertOwner(membership);
  try {
    await cancelReservation({ organizationId: membership.organizationId, actorUserId: membership.userId, reservationId, reason: "Cancelled from the reservation list." });
  } catch (error) { return toFormError(error); }
  revalidatePath("/reservations"); revalidatePath(`/reservations/${reservationId}`); revalidatePath("/calendar");
  return { success: true };
}

export async function updateReservationAction(reservationId: string, _prev: ReservationFormState, formData: FormData): Promise<ReservationFormState> {
  const membership = await requireMembership();
  assertOwner(membership);
  try {
    await updateReservation({ organizationId: membership.organizationId, actorUserId: membership.userId, reservationId, data: {
      checkIn: readString(formData, "checkIn"), checkOut: readString(formData, "checkOut"), guestCount: Number(readString(formData, "guestCount")),
      // "new" creates a guest profile from the contact fields below.
      guestId: readString(formData, "guestId") === "new" ? undefined : readString(formData, "guestId") || undefined,
      primaryGuest: readString(formData, "guestName") ? { name: readString(formData, "guestName"), email: readString(formData, "guestEmail") || undefined, phone: readString(formData, "guestPhone") || undefined } : undefined,
      unitId: readString(formData, "unitId"), occupantNames: formData.getAll("occupantName").map((value) => String(value).trim()),
      charges: formData.getAll("chargeType").map((type, index) => ({ type: String(type) as ChargeLineInput["type"], description: String(formData.getAll("chargeDescription")[index] ?? "").trim(), quantity: Number(formData.getAll("chargeQuantity")[index] ?? 0), unitAmountCents: pesosToCentavos(String(formData.getAll("chargeAmountPesos")[index] ?? "")) })),
    } });
  } catch (error) { return toFormError(error); }
  revalidatePath("/reservations"); revalidatePath(`/reservations/${reservationId}`); revalidatePath("/calendar");
  return { success: true, reservationId };
}

export async function checkInAction(
  reservationId: string,
  _prev: ReservationFormState,
  formData: FormData,
): Promise<ReservationFormState> {
  const membership = await requireMembership();
  try {
    await checkIn({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      reservationId,
      data: { note: readString(formData, "note") },
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath(`/reservations/${reservationId}`);
  revalidatePath("/calendar");
  return { success: true };
}

export async function checkOutAction(
  reservationId: string,
  _prev: ReservationFormState,
  formData: FormData,
): Promise<ReservationFormState> {
  const membership = await requireMembership();
  try {
    await checkOut({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      reservationId,
      // Blank means "now"; the turnover starts at this actual departure time.
      data: { note: readString(formData, "note"), actualCheckoutAt: readString(formData, "actualCheckoutAt") || undefined },
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath(`/reservations/${reservationId}`);
  revalidatePath("/calendar");
  revalidatePath("/tasks");
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
  void _prev;
  void _formData;
  const membership = await requireMembership();
  assertOwner(membership);
  try {
    const link = await createGuestLink({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      reservationId,
    });
    revalidatePath(`/reservations/${reservationId}`);
    return { token: link.token, tokenId: link.tokenId };
  } catch (error) {
    if (error instanceof ReservationError || error instanceof PermissionError) {
      return { error: error.message };
    }
    return { error: unexpectedErrorMessage(error, "reservations") };
  }
}

export async function revokeGuestLinkAction(
  reservationId: string,
  tokenId: string,
  _prev: GuestLinkFormState,
  _formData: FormData,
): Promise<GuestLinkFormState> {
  void _prev;
  void _formData;
  const membership = await requireMembership();
  assertOwner(membership);
  try {
    await revokeGuestLink({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      tokenId,
    });
  } catch (error) {
    if (error instanceof ReservationError || error instanceof PermissionError) {
      return { error: error.message };
    }
    return { error: unexpectedErrorMessage(error, "reservations") };
  }
  revalidatePath(`/reservations/${reservationId}`);
  return {};
}
