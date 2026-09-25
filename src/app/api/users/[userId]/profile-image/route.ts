import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { createObjectStorageFromEnvironment, StorageError } from "@/server/storage/service";

export const runtime = "nodejs";

/** Serve a user's private profile picture only to that user. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const currentUser = await requireUser();
  const { userId } = await params;
  if (currentUser.id !== userId) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const profile = await db.query.user.findFirst({
    columns: { image: true },
    where: eq(user.id, userId),
  });
  if (!profile?.image?.startsWith(`user/${userId}/`)) {
    return Response.json({ error: "Profile picture not found." }, { status: 404 });
  }

  try {
    const image = await createObjectStorageFromEnvironment().get(profile.image);
    const bytes = new Uint8Array(image.body.byteLength);
    bytes.set(image.body);
    return new Response(bytes, {
      headers: {
        "Content-Type": image.contentType ?? "image/png",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof StorageError) {
      return Response.json({ error: "Profile picture not found." }, { status: 404 });
    }
    throw error;
  }
}
