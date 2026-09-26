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
  /**
   * The platform takes the guest's payment itself, so the unit's reservation
   * fee doesn't apply. Messaging channels (Facebook, Messenger) are just ways
   * of reaching the team: their bookings still owe the fee.
   */
  collectsPayment: boolean;
}

/**
 * Channels every organization starts with, in the order the reservation form
 * lists them. Commissions are common defaults; teams edit them to match
 * their own accounts.
 */
export const DEFAULT_PLATFORMS: readonly DefaultPlatform[] = [
  { key: "direct", name: "Direct", logoUrl: "/platforms/direct.svg", websiteUrl: null, color: "#2F5D50", commissionBasisPoints: null, collectsPayment: false },
  { key: "airbnb", name: "Airbnb", logoUrl: "/platforms/airbnb.svg", websiteUrl: "https://www.airbnb.com", color: "#FF5A5F", commissionBasisPoints: 300, collectsPayment: true },
  { key: "booking_com", name: "Booking.com", logoUrl: "/platforms/booking-com.svg", websiteUrl: "https://www.booking.com", color: "#003580", commissionBasisPoints: 1500, collectsPayment: true },
  { key: "agoda", name: "Agoda", logoUrl: "/platforms/agoda.svg", websiteUrl: "https://www.agoda.com", color: "#5C2D91", commissionBasisPoints: 1500, collectsPayment: true },
  { key: "expedia", name: "Expedia", logoUrl: "/platforms/expedia.svg", websiteUrl: "https://www.expedia.com", color: "#FDB913", commissionBasisPoints: 1500, collectsPayment: true },
  { key: "facebook", name: "Facebook", logoUrl: "/platforms/facebook.svg", websiteUrl: "https://www.facebook.com", color: "#1877F2", commissionBasisPoints: null, collectsPayment: false },
  { key: "messenger", name: "Messenger", logoUrl: "/platforms/messenger.svg", websiteUrl: "https://www.messenger.com", color: "#0A7CFF", commissionBasisPoints: null, collectsPayment: false },
  { key: "instagram", name: "Instagram", logoUrl: "/platforms/instagram.svg", websiteUrl: "https://www.instagram.com", color: "#E1306C", commissionBasisPoints: null, collectsPayment: false },
  { key: "walk_in", name: "Walk-in", logoUrl: "/platforms/walk-in.svg", websiteUrl: null, color: "#8A6F4D", commissionBasisPoints: null, collectsPayment: false },
  { key: "referral", name: "Referral", logoUrl: "/platforms/referral.svg", websiteUrl: null, color: "#6B7F3A", commissionBasisPoints: null, collectsPayment: false },
];

/** The organization's own channels: no outside confirmation code to record. */
export const PLATFORMS_WITHOUT_REFERENCE: readonly string[] = ["direct", "walk_in", "referral"];
