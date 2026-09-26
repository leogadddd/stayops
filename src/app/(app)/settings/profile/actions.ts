"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { unexpectedErrorMessage } from "@/lib/errors";
import { imageUploadFromDataUrl } from "@/server/inventory/image-upload";
import { createObjectStorageFromEnvironment, StorageError } from "@/server/storage/service";

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
    const removeImage = formData.get("removeProfileImage") === "true";
    const uploadedImage = removeImage
      ? null
      : await imageUploadFromDataUrl(String(formData.get("profileImageDataUrl") ?? ""));
    const imageKey = `user/${currentUser.id}/profile.webp`;
    if (uploadedImage) {
      await createObjectStorageFromEnvironment().put({ key: imageKey, ...uploadedImage });
    }
    await db
      .update(user)
      .set({
        name,
        ...(removeImage ? { image: null } : uploadedImage ? { image: imageKey } : {}),
        updatedAt: new Date(),
      })
      .where(eq(user.id, currentUser.id));
    if (removeImage && currentUser.image?.startsWith(`user/${currentUser.id}/`)) {
      await createObjectStorageFromEnvironment().delete(currentUser.image);
    }
    revalidatePath("/settings/profile");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    if (error instanceof StorageError) return { error: error.message };
    return { error: unexpectedErrorMessage(error, "profile") };
  }
}
