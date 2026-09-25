"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { unexpectedErrorMessage } from "@/lib/errors";

export type ProfileFormState = { error?: string; success?: boolean };

export async function saveProfile(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const currentUser = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 80) {
    return { error: "Your name must be between 2 and 80 characters." };
  }
  try {
    await db
      .update(user)
      .set({ name, updatedAt: new Date() })
      .where(eq(user.id, currentUser.id));
    revalidatePath("/settings/profile");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return { error: unexpectedErrorMessage(error, "profile") };
  }
}
