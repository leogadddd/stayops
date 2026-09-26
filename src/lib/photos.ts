/**
 * Property and unit cover photos live in object storage under a random key
 * (`org/<org>/photos/<uuid>`), served to members through /api routes. Older
 * photos were saved inline as data URLs and are shown as they are.
 */
export type PhotoKind = "property" | "unit";

export function isStoredPhotoKey(value: string | null | undefined, organizationId?: string): value is string {
  if (!value || value.startsWith("data:")) return false;
  return organizationId ? value.startsWith(`org/${organizationId}/photos/`) : value.startsWith("org/");
}

/** A browser-ready src for a property or unit cover photo, or null for none. */
export function photoSrc(
  kind: PhotoKind,
  entity: { id: string; imageUrl: string | null } | null | undefined,
): string | null {
  const value = entity?.imageUrl;
  if (!entity || !value) return null;
  if (!isStoredPhotoKey(value)) return value;
  // The key changes with every upload, so it doubles as a cache buster.
  const version = value.slice(value.lastIndexOf("/") + 1, value.lastIndexOf("/") + 9);
  return `/api/${kind === "property" ? "properties" : "units"}/${entity.id}/photo?v=${version}`;
}

/** The unit's own photo, falling back to its property's. */
export function unitOrPropertyPhotoSrc(
  unit: { id: string; imageUrl: string | null } | null | undefined,
  property: { id: string; imageUrl: string | null } | null | undefined,
): string | null {
  return photoSrc("unit", unit) ?? photoSrc("property", property);
}
