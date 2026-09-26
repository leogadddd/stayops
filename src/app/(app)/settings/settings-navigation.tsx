"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SETTINGS_NAVIGATION } from "./settings-registry";
import type { RoleKey } from "@/lib/permissions";

export function SettingsNavigation({ role }: { role: RoleKey }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings navigation" className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
      {SETTINGS_NAVIGATION.filter((item) => !("ownerOnly" in item) || !item.ownerOnly || role === "owner").map((item) => {
        const { href, label, icon: Icon } = item;
        const active = ("exact" in item && item.exact) ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-3.5 text-sm font-medium transition-colors",
              active ? "bg-pine text-white" : "text-ink/65 hover:bg-pine-mist hover:text-pine",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
