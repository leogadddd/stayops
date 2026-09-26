import { Building2, Globe2, KeyRound, Share2, SlidersHorizontal, UserRound, UsersRound } from "lucide-react";
import type { Permission } from "@/lib/permissions";

/**
 * Add a category here as its dedicated settings surface is introduced.
 * The navigation shell owns ordering and labels; each page owns its data and UI.
 * `requires` hides the link from members without that permission; the page
 * checks access again on its own.
 */
export const SETTINGS_NAVIGATION: readonly {
  href: string;
  label: string;
  icon: typeof Building2;
  requires?: Permission;
  /** Only owners and admins can manage the permission matrix. */
  managesPermissions?: true;
}[] = [
  { href: "/settings/general", label: "General", icon: SlidersHorizontal },
  { href: "/settings/profile", label: "Profile", icon: UserRound },
  { href: "/settings/organization", label: "Organization", icon: Building2, requires: "organization.update" },
  { href: "/settings/platforms", label: "Booking platforms", icon: Share2, requires: "platforms.view" },
  { href: "/settings/team", label: "Team", icon: UsersRound, requires: "team.view" },
  { href: "/settings/permissions", label: "Permissions", icon: KeyRound, managesPermissions: true },
  { href: "/settings/region", label: "Region", icon: Globe2, requires: "organization.update" },
];
