import { eq } from "drizzle-orm";
import { requireMembership } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { createObjectStorageFromEnvironment, StorageError } from "@/server/storage/service";

export const runtime = "nodejs";

/** Serve the private logo to members of its organization. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  const membership = await requireMembership();
  const { organizationId } = await params;
  if (membership.organizationId !== organizationId) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const organization = await db.query.organizations.findFirst({
    columns: { logoUrl: true },
    where: eq(organizations.id, organizationId),
  });
  if (!organization?.logoUrl || organization.logoUrl.startsWith("data:")) {
    return Response.json({ error: "Logo not found." }, { status: 404 });
  }

  try {
    const logo = await createObjectStorageFromEnvironment().get(organization.logoUrl);
    // Copy into an ArrayBuffer-backed view: Response's browser-facing type
    // does not accept Node's ArrayBufferLike-backed Uint8Array directly.
    const bytes = new Uint8Array(logo.body.byteLength);
    bytes.set(logo.body);
    return new Response(bytes, {
      headers: {
        "Content-Type": logo.contentType ?? "image/png",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof StorageError) {
      return Response.json({ error: "Logo not found." }, { status: 404 });
    }
    throw error;
  }
}
