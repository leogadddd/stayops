import { requireMembership } from "@/lib/auth/session";
import { getPropertyOrThrow } from "@/server/inventory/service";
import { InventoryError } from "@/server/inventory/validation";
import { photoResponse } from "@/server/inventory/photo-response";

export const runtime = "nodejs";

/** Serve a property's cover photo to members of its organization. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  const membership = await requireMembership();
  const { propertyId } = await params;
  try {
    const property = await getPropertyOrThrow(membership.organizationId, propertyId);
    return photoResponse(membership.organizationId, property.imageUrl);
  } catch (error) {
    if (error instanceof InventoryError) {
      return Response.json({ error: "Photo not found." }, { status: 404 });
    }
    throw error;
  }
}
