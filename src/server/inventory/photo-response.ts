import "server-only";

import { isStoredPhotoKey } from "@/lib/photos";
import { createObjectStorageFromEnvironment, StorageError } from "@/server/storage/service";

/**
 * Stream a stored cover photo. The key must belong to the member's own
 * organization, and the URL carries a per-upload version, so it can be cached.
 */
export async function photoResponse(organizationId: string, imageUrl: string | null | undefined) {
  if (!isStoredPhotoKey(imageUrl, organizationId)) {
    return Response.json({ error: "Photo not found." }, { status: 404 });
  }
  try {
    const photo = await createObjectStorageFromEnvironment().get(imageUrl);
    // Copy into an ArrayBuffer-backed view that Response accepts.
    const bytes = new Uint8Array(photo.body.byteLength);
    bytes.set(photo.body);
    return new Response(bytes, {
      headers: {
        "Content-Type": photo.contentType ?? "image/jpeg",
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof StorageError) {
      return Response.json({ error: "Photo not found." }, { status: 404 });
    }
    throw error;
  }
}
