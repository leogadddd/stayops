"use client";

import { useRouter } from "next/navigation";

export function useReservationSaved<State extends { success?: boolean }>(
  action: (previous: State, formData: FormData) => Promise<State>,
  reservationId: string,
) {
  const router = useRouter();
  return async (previous: State, formData: FormData): Promise<State> => {
    const result = await action(previous, formData);
    // Revalidation can remove status-gated forms before a success effect runs.
    if (result.success) {
      router.replace(`/reservations/${reservationId}`);
      router.refresh();
    }
    return result;
  };
}
