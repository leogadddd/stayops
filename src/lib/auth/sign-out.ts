"use client";

import { authClient } from "@/lib/auth/client";

export async function signOutAndRedirect(
  redirect: (path: string) => void = (path) => window.location.replace(path),
) {
  const { error } = await authClient.signOut();
  if (error) {
    throw new Error(error.message || "Could not sign out. Please try again.");
  }
  redirect("/login");
}
