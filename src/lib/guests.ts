/** IDs guests commonly present at Philippine check-in desks. */
export const GUEST_ID_TYPES = [
  "passport",
  "national_id",
  "drivers_license",
  "umid",
  "sss",
  "philhealth",
  "postal_id",
  "voters_id",
  "prc",
  "other",
] as const;

export type GuestIdType = (typeof GUEST_ID_TYPES)[number];

export const GUEST_ID_TYPE_LABELS: Record<GuestIdType, string> = {
  passport: "Passport",
  national_id: "PhilSys National ID",
  drivers_license: "Driver's license",
  umid: "UMID",
  sss: "SSS ID",
  philhealth: "PhilHealth ID",
  postal_id: "Postal ID",
  voters_id: "Voter's ID",
  prc: "PRC ID",
  other: "Other ID",
};

export const GUEST_TAG_LIMIT = 10;

/** "VIP, returning,  vip" → ["VIP", "returning"]: trimmed, de-duplicated ignoring case. */
export function parseGuestTags(value: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of value.split(",")) {
    const tag = raw.trim().replace(/\s+/g, " ");
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    tags.push(tag);
  }
  return tags;
}
