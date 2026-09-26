export interface DefaultPlatform {
  /** Stable key, so reseeding recognises a platform the team renamed. */
  key: string;
  name: string;
  /** Served from `public/platforms`; the app's CSP only allows same-origin images. */
  logoUrl: string;
  websiteUrl: string | null;
  color: string;
  /** Typical host commission in basis points (1500 = 15%); null when none. */
  commissionBasisPoints: number | null;
}

/**
 * Channels every organization starts with, in the order the reservation form
 * lists them. Commissions are common defaults; teams edit them to match
 * their own accounts.
 */
export const DEFAULT_PLATFORMS: readonly DefaultPlatform[] = [
  { key: "direct", name: "Direct", logoUrl: "/platforms/direct.svg", websiteUrl: null, color: "#2F5D50", commissionBasisPoints: null },
  { key: "airbnb", name: "Airbnb", logoUrl: "/platforms/airbnb.svg", websiteUrl: "https://www.airbnb.com", color: "#FF5A5F", commissionBasisPoints: 300 },
  { key: "booking_com", name: "Booking.com", logoUrl: "/platforms/booking-com.svg", websiteUrl: "https://www.booking.com", color: "#003580", commissionBasisPoints: 1500 },
  { key: "agoda", name: "Agoda", logoUrl: "/platforms/agoda.svg", websiteUrl: "https://www.agoda.com", color: "#5C2D91", commissionBasisPoints: 1500 },
  { key: "expedia", name: "Expedia", logoUrl: "/platforms/expedia.svg", websiteUrl: "https://www.expedia.com", color: "#FDB913", commissionBasisPoints: 1500 },
  { key: "facebook", name: "Facebook", logoUrl: "/platforms/facebook.svg", websiteUrl: "https://www.facebook.com", color: "#1877F2", commissionBasisPoints: null },
  { key: "instagram", name: "Instagram", logoUrl: "/platforms/instagram.svg", websiteUrl: "https://www.instagram.com", color: "#E1306C", commissionBasisPoints: null },
  { key: "walk_in", name: "Walk-in", logoUrl: "/platforms/walk-in.svg", websiteUrl: null, color: "#8A6F4D", commissionBasisPoints: null },
  { key: "referral", name: "Referral", logoUrl: "/platforms/referral.svg", websiteUrl: null, color: "#6B7F3A", commissionBasisPoints: null },
];

/** The organization's own channels: no outside confirmation code to record. */
export const PLATFORMS_WITHOUT_REFERENCE: readonly string[] = ["direct", "walk_in", "referral"];
