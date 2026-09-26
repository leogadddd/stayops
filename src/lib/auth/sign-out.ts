"use client";

import { authClient } from "@/lib/auth/client";
import { setToastAfterNavigation } from "@/components/ui/sonner";
import { clearL1Recents } from "@/lib/l1-recents";

export async function signOutAndRedirect(
  redirect: (path: string) => void = (path) => window.location.replace(path),
) {
  const { error } = await authClient.signOut();
  if (error) {
    throw new Error(error.message || "Could not sign out. Please try again.");
  }
  clearL1Recents();
  setToastAfterNavigation("success", "Signed out successfully.");
  redirect("/login");
}
