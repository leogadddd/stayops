"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Building2, Calendar, Receipt, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";

/**
 * App navigation. Entries are added per slice so there is never a dead link:
 * tasks, expenses and reports join as their slices land.
 */
const NAV_ITEMS = [
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/reservations", label: "Reservations", icon: BookOpen },
  { href: "/guests", label: "Guests", icon: Users },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/settings/properties", label: "Properties", icon: Building2 },
  { href: "/settings", label: "Settings", icon: Settings, exact: true },
] as const;

export function AppSidebar({
  organizationName,
  userName,
  userEmail,
}: {
  organizationName: string;
  userName: string;
  userEmail: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-dvh w-60 flex-col bg-pine text-paper max-lg:hidden">
      <div className="px-5 pb-6 pt-6">
        <Logo className="text-paper" />
        <p className="mt-1 truncate px-0.5 text-xs text-paper/50">
          {organizationName}
        </p>
      </div>

      <nav aria-label="Primary" className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon, ...rest }) => {
          const active =
            "exact" in rest && rest.exact
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-paper/10 text-white"
                  : "text-paper/75 hover:bg-paper/5 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-paper/10 p-4">
        <p className="truncate text-sm font-medium">{userName}</p>
        <p className="truncate text-xs text-paper/50">{userEmail}</p>
        <form action="/api/auth/sign-out" method="post" className="mt-3">
          <button
            type="submit"
            className="text-xs font-medium text-paper/60 underline-offset-4 hover:text-paper hover:underline"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}

/** Compact top bar for small screens (the sidebar is desktop-only). */
export function MobileTopBar({ organizationName }: { organizationName: string }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-pine/10 bg-paper/90 px-4 py-3 backdrop-blur lg:hidden">
      <Logo />
      <span className="max-w-[45%] truncate text-xs text-ink/50">
        {organizationName}
      </span>
    </header>
  );
}
