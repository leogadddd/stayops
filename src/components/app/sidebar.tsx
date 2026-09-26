"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Building2,
  Calendar,
  ClipboardList,
  Receipt,
  BarChart3,
  Settings,
  Users,
  Menu,
  X,
  ChevronRight,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { AccountMenu } from "@/components/app/account-menu";
import { LiveClock } from "@/components/app/live-clock";
import { OrganizationSelector, type OrganizationOption } from "@/components/app/organization-selector";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    ownerOnly: false,
  },
  { href: "/calendar", label: "Calendar", icon: Calendar, ownerOnly: false },
  {
    href: "/reservations",
    label: "Reservations",
    icon: BookOpen,
    ownerOnly: false,
  },
  {
    href: "/properties",
    label: "Properties",
    icon: Building2,
    ownerOnly: true,
  },
  { href: "/guests", label: "Guests", icon: Users, ownerOnly: false },
  { href: "/tasks", label: "Tasks", icon: ClipboardList, ownerOnly: false },
  { href: "/expenses", label: "Expenses", icon: Receipt, ownerOnly: true },
  { href: "/reports", label: "Reports", icon: BarChart3, ownerOnly: true },
  {
    href: "/settings/general",
    label: "Settings",
    icon: Settings,
    ownerOnly: true,
  },
] as const;

type SidebarProps = {
  organizationName: string;
  userName: string;
  userEmail: string;
  userImage?: string | null;
  role: "owner" | "staff";
  organizationId?: string;
  organizations?: OrganizationOption[];
};

function Navigation({
  role,
  onNavigate,
}: {
  role: SidebarProps["role"];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3"
    >
      {NAV_ITEMS.filter((item) => !item.ownerOnly || role === "owner").map(
        ({ href, label, icon: Icon }) => {
          const active =
            href === "/settings/general"
              ? pathname.startsWith("/settings") &&
                !pathname.startsWith("/properties")
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg border-l-2 px-4 py-3 text-sm font-medium transition-colors",
                active
                  ? "border-[#d58d74] bg-sage/20 text-white"
                  : "border-transparent text-paper/80 hover:bg-paper/10 hover:text-white",
              )}
            >
              <Icon
                className="h-5 w-5 shrink-0"
                strokeWidth={1.6}
                aria-hidden
              />
              {label}
            </Link>
          );
        },
      )}
    </nav>
  );
}

export function AppSidebar(props: SidebarProps) {
  return (
    <aside
      data-testid="app-sidebar"
      className="hidden h-full w-60 shrink-0 flex-col bg-pine text-paper lg:flex xl:w-64"
    >
      <Link
        href="/dashboard"
        aria-label="StayOps dashboard"
        className="block px-6 pb-5 pt-7"
      >
        <Logo className="text-paper" />
        <p className="mt-3 truncate text-xs tracking-wide text-paper/60">
          {props.organizationName}
        </p>
      </Link>
      <Navigation role={props.role} />
    </aside>
  );
}

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  calendar: "Calendar",
  availability: "Check availability",
  reservations: "Reservations",
  guests: "Guests",
  tasks: "Tasks",
  expenses: "Expenses",
  reports: "Reports",
  "audit-logs": "Audit logs",
  settings: "Settings",
  properties: "Properties",
  units: "Units",
  new: "New",
  edit: "Edit",
  organization: "Organization",
  "payment-instructions": "Payment instructions",
  staff: "Staff",
  payments: "Payments",
  refunds: "Refunds",
  deductions: "Deductions",
  damage: "Damage",
  proofs: "Payment proofs",
  "check-in": "Check in",
  "check-out": "Check out",
  confirm: "Confirm",
  cancel: "Cancel",
  blocks: "Blocks",
  checklist: "Checklist",
  ready: "Mark ready",
  resolve: "Resolve",
  record: "Record payment",
  confirmation: "Saved",
};

export function AppHeader({
  initialNow,
  ...props
}: SidebarProps & { initialNow: string }) {
  const pathname = usePathname();
  const mobileNav = useRef<HTMLDialogElement>(null);
  const segments = pathname.split("/").filter(Boolean);
  const organizations = props.organizations ?? [{
    id: props.organizationId ?? "current",
    name: props.organizationName,
    role: props.role,
  }];
  const activeOrganizationId = props.organizationId ?? organizations[0]!.id;
  return (
    <header
      data-testid="app-header"
      className="z-20 flex h-20 shrink-0 items-center justify-between gap-4 border-b border-pine/12 bg-linen px-4 sm:px-6 lg:px-8"
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label="Open navigation"
          aria-haspopup="dialog"
          onClick={() => mobileNav.current?.showModal()}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-pine/15 text-pine lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link
          href="/dashboard"
          aria-label="StayOps dashboard"
          className="inline-flex sm:hidden"
        >
          <Logo className="h-8 w-32" />
        </Link>
        <nav aria-label="Breadcrumb" className="hidden min-w-0 sm:block">
          {/* <ol className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {segments.map((segment, index) => {
              const label = SEGMENT_LABELS[segment] ?? "Details";
              const last = index === segments.length - 1;
              const href = `/${segments.slice(0, index + 1).join("/")}`;
              const linked =
                !last && NAV_ITEMS.some((item) => item.href === href);
              return (
                <li
                  key={href}
                  className={cn(
                    "flex items-center gap-2",
                    last ? "font-semibold text-pine" : "text-ink/55",
                    index < segments.length - 2 ? "hidden sm:flex" : "",
                  )}
                >
                  {index > 0 ? (
                    <ChevronRight
                      className="h-3.5 w-3.5 shrink-0 text-ink/35"
                      aria-hidden
                    />
                  ) : null}
                  {linked ? (
                    <Link href={href} className="hover:text-clay">
                      {label}
                    </Link>
                  ) : (
                    <span aria-current={last ? "page" : undefined}>
                      {label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol> */}
        </nav>
        <OrganizationSelector
          organizations={organizations}
          activeOrganizationId={activeOrganizationId}
        />
      </div>
      <div className="flex shrink-0 items-center gap-5">
        <LiveClock initialNow={initialNow} />
        <AccountMenu
          userName={props.userName}
          userEmail={props.userEmail}
          userImage={props.userImage ?? null}
          role={props.role}
        />
      </div>
      <dialog
        ref={mobileNav}
        aria-label="Navigation"
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[85vw] border-0 bg-pine p-0 text-paper backdrop:bg-pine-deep/50"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-2 px-5 pb-4 pt-6">
            <Logo className="w-40 text-paper" />
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => mobileNav.current?.close()}
              className="rounded-lg p-2 hover:bg-paper/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="truncate px-6 pb-3 text-xs text-paper/65">
            {props.organizationName}
          </p>
          <Navigation
            role={props.role}
            onNavigate={() => mobileNav.current?.close()}
          />
        </div>
      </dialog>
    </header>
  );
}
