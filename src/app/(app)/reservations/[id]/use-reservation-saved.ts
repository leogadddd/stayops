"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function useReservationSaved<State extends { success?: boolean }>(
  action: (previous: State, formData: FormData) => Promise<State>,
  reservationId: string,
  successMessage: string,
) {
  const router = useRouter();
  return async (previous: State, formData: FormData): Promise<State> => {
    const result = await action(previous, formData);
    // Revalidation can remove status-gated forms before a success effect runs.
    if (result.success) {
      toast.success(successMessage);
      router.replace(`/reservations/${reservationId}`);
      router.refresh();
    }
    return result;
  };
}
