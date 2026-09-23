"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireMembership, assertOwner, PermissionError } from "@/lib/auth/session";
import {
  addDeduction,
  dismissProof,
  recordPayment,
  recordRefund,
} from "@/server/payments/service";
import { PaymentError } from "@/server/payments/validation";

export interface PaymentFormState {
  error?: string;
  success?: boolean;
}

function readString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function toFormError(error: unknown): PaymentFormState {
  if (error instanceof PaymentError) {
    return { error: error.message };
  }
  if (error instanceof PermissionError) {
    return { error: error.message };
  }
  if (error instanceof ZodError) {
    const first = error.issues[0];
    return { error: first ? first.message : "Check the form and try again." };
  }
  throw error;
}

export async function recordPaymentAction(
  reservationId: string,
  _prev: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const membership = await requireMembership();
  assertOwner(membership);
  try {
    await recordPayment({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      reservationId,
      data: {
        amountPesos: readString(formData, "amountPesos"),
        allocation: readString(formData, "allocation"),
        method: readString(formData, "method"),
        reference: readString(formData, "reference") || undefined,
        receivedAt: readString(formData, "receivedAt") || undefined,
        idempotencyKey: readString(formData, "idempotencyKey") || undefined,
      },
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath(`/reservations/${reservationId}`);
  revalidatePath("/reservations");
  return { success: true };
}

export async function recordProofPaymentAction(
  reservationId: string,
  proofId: string,
  _prev: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const membership = await requireMembership();
  assertOwner(membership);
  try {
    await recordPayment({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      reservationId,
      proofId,
      data: {
        amountPesos: readString(formData, "amountPesos"),
        allocation: readString(formData, "allocation"),
        method: readString(formData, "method"),
        reference: readString(formData, "reference") || undefined,
        receivedAt: readString(formData, "receivedAt") || undefined,
        // A reference can produce only one payment, including concurrent retries.
        idempotencyKey: `proof:${proofId}`,
      },
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath(`/reservations/${reservationId}`);
  revalidatePath("/reservations");
  return { success: true };
}

export async function recordRefundAction(
  reservationId: string,
  _prev: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const membership = await requireMembership();
  assertOwner(membership);
  try {
    await recordRefund({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      reservationId,
      data: {
        amountPesos: readString(formData, "amountPesos"),
        allocation: readString(formData, "allocation"),
        method: readString(formData, "method"),
        reason: readString(formData, "reason"),
      },
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath(`/reservations/${reservationId}`);
  revalidatePath("/reservations");
  return { success: true };
}

export async function addDeductionAction(
  reservationId: string,
  _prev: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const membership = await requireMembership();
  assertOwner(membership);
  try {
    await addDeduction({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      reservationId,
      data: {
        amountPesos: readString(formData, "amountPesos"),
        reason: readString(formData, "reason"),
        damageReportId: readString(formData, "damageReportId") || undefined,
      },
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath(`/reservations/${reservationId}`);
  return { success: true };
}

export async function dismissProofAction(
  reservationId: string,
  proofId: string,
  _prev: PaymentFormState,
  _formData: FormData,
): Promise<PaymentFormState> {
  void _prev;
  void _formData;
  const membership = await requireMembership();
  assertOwner(membership);
  try {
    await dismissProof({
      organizationId: membership.organizationId,
      actorUserId: membership.userId,
      proofId,
    });
  } catch (error) {
    return toFormError(error);
  }
  revalidatePath(`/reservations/${reservationId}`);
  return { success: true };
}
