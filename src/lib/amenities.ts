import type { AmenityScope } from "@/lib/db/schema";

export interface DefaultAmenity {
  name: string;
  /** Key into AMENITY_ICONS in the amenity picker. */
  icon: string;
}

/** What the building or compound offers. */
export const DEFAULT_PROPERTY_AMENITIES: readonly DefaultAmenity[] = [
  { name: "Swimming pool", icon: "pool" },
  { name: "Parking", icon: "parking" },
  { name: "Gym", icon: "gym" },
  { name: "Elevator", icon: "elevator" },
  { name: "24/7 security", icon: "security" },
  { name: "CCTV", icon: "cctv" },
  { name: "Garden", icon: "garden" },
  { name: "Playground", icon: "playground" },
  { name: "Laundry area", icon: "laundry" },
  { name: "Function room", icon: "function-room" },
  { name: "Rooftop deck", icon: "rooftop" },
  { name: "Pet friendly", icon: "pets" },
  { name: "Beach access", icon: "beach" },
  { name: "Convenience store", icon: "store" },
  { name: "Wheelchair accessible", icon: "accessible" },
  { name: "Backup generator", icon: "generator" },
];

/** What's inside a unit for the guest. */
export const DEFAULT_UNIT_AMENITIES: readonly DefaultAmenity[] = [
  { name: "Wi-Fi", icon: "wifi" },
  { name: "Air conditioning", icon: "aircon" },
  { name: "Kitchen tools", icon: "kitchen" },
  { name: "Refrigerator", icon: "fridge" },
  { name: "Microwave", icon: "microwave" },
  { name: "Rice cooker", icon: "rice-cooker" },
  { name: "Coffee maker", icon: "coffee" },
  { name: "Dining set", icon: "dining" },
  { name: "Towels", icon: "towels" },
  { name: "Toiletries", icon: "toiletries" },
  { name: "Hot shower", icon: "shower" },
  { name: "Hair dryer", icon: "hair-dryer" },
  { name: "Bed linens", icon: "linens" },
  { name: "Smart TV", icon: "tv" },
  { name: "Streaming apps", icon: "streaming" },
  { name: "Washing machine", icon: "laundry" },
  { name: "Iron", icon: "iron" },
  { name: "Workspace", icon: "workspace" },
  { name: "Balcony", icon: "balcony" },
  { name: "Drinking water", icon: "water" },
];

export const DEFAULT_AMENITIES: Record<AmenityScope, readonly DefaultAmenity[]> = {
  property: DEFAULT_PROPERTY_AMENITIES,
  unit: DEFAULT_UNIT_AMENITIES,
};

export const AMENITY_NAME_MIN = 2;
export const AMENITY_NAME_MAX = 60;

/** Collapses whitespace; returns null when the name is outside the allowed length. */
export function normalizeAmenityName(value: string): string | null {
  const name = value.trim().replace(/\s+/g, " ");
  return name.length >= AMENITY_NAME_MIN && name.length <= AMENITY_NAME_MAX ? name : null;
}
