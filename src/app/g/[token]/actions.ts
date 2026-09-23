"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { submitGuestPaymentProof } from "@/server/payments/service";
import { PaymentError } from "@/server/payments/validation";

export interface GuestProofFormState {
  error?: string;
  success?: boolean;
}

export async function submitPaymentProofAction(
  token: string,
  _prev: GuestProofFormState,
  formData: FormData,
): Promise<GuestProofFormState> {
  const reference = String(formData.get("reference") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  try {
    await submitGuestPaymentProof({
      token,
      data: {
        reference,
        note: note || undefined,
      },
    });
  } catch (error) {
    if (error instanceof PaymentError) {
      return { error: error.message };
    }
    if (error instanceof ZodError) {
      const first = error.issues[0];
      return { error: first ? first.message : "Check the form and try again." };
    }
    throw error;
  }
  revalidatePath(`/g/${token}`);
  return { success: true };
}
