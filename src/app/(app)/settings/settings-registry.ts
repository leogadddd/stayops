import { Building2, Globe2, SlidersHorizontal } from "lucide-react";

/**
 * Add a category here as its dedicated settings surface is introduced.
 * The navigation shell owns ordering and labels; each page owns its data and UI.
 */
export const SETTINGS_NAVIGATION = [
  { href: "/settings/general", label: "General", icon: SlidersHorizontal },
  { href: "/settings/organization", label: "Organization", icon: Building2, ownerOnly: true },
  { href: "/settings/region", label: "Region", icon: Globe2, ownerOnly: true },
] as const;
