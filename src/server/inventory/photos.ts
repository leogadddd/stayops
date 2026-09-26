import "server-only";

import { randomUUID } from "node:crypto";
import { isStoredPhotoKey } from "@/lib/photos";
import { createObjectStorageFromEnvironment } from "@/server/storage/service";

/** Store a cover photo under a fresh key and return that key for the record. */
export async function storeInventoryPhoto(
  organizationId: string,
  upload: { contentType: string; body: Uint8Array },
): Promise<string> {
  const key = `org/${organizationId}/photos/${randomUUID()}`;
  await createObjectStorageFromEnvironment().put({ key, ...upload });
  return key;
}

/**
 * Remove a replaced photo. Best effort: the record already points at the new
 * photo, so a leftover object is only wasted space.
 */
export async function discardInventoryPhoto(organizationId: string, imageUrl: string | null | undefined) {
  if (!isStoredPhotoKey(imageUrl, organizationId)) return;
  try {
    await createObjectStorageFromEnvironment().delete(imageUrl);
  } catch (error) {
    console.error("[inventory] could not delete replaced photo", error);
  }
}
