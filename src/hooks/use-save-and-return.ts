"use client";

import { useRouter } from "next/navigation";
import { setToastAfterNavigation } from "@/components/ui/sonner";

/**
 * Wrap a form action so a successful save goes to `href` (closing a modal
 * opened over it) and shows the success toast there. `href` can be worked
 * out from the result, e.g. to open a record the save just created.
 */
export function useSaveAndReturn<State extends { success?: boolean }>(
  action: (previous: State, formData: FormData) => Promise<State>,
  href: string | ((result: State) => string),
  successMessage: string,
) {
  const router = useRouter();
  return async (previous: State, formData: FormData): Promise<State> => {
    const result = await action(previous, formData);
    if (result.success) {
      setToastAfterNavigation("success", successMessage);
      router.replace(typeof href === "function" ? href(result) : href);
      router.refresh();
    }
    return result;
  };
}
