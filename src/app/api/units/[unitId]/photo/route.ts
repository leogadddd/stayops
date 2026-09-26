import { requireMembership } from "@/lib/auth/session";
import { getUnitOrThrow } from "@/server/inventory/service";
import { InventoryError } from "@/server/inventory/validation";
import { photoResponse } from "@/server/inventory/photo-response";

export const runtime = "nodejs";

/** Serve a unit's cover photo to members of its organization. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ unitId: string }> },
) {
  const membership = await requireMembership();
  const { unitId } = await params;
  try {
    const unit = await getUnitOrThrow(membership.organizationId, unitId);
    return photoResponse(membership.organizationId, unit.imageUrl);
  } catch (error) {
    if (error instanceof InventoryError) {
      return Response.json({ error: "Photo not found." }, { status: 404 });
    }
    throw error;
  }
}
