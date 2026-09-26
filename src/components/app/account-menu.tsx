"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { signOutAndRedirect } from "@/lib/auth/sign-out";
import { roleLabel, type RoleKey } from "@/lib/permissions";

export function AccountMenu({ userName, userEmail, userImage, role, viaL1 = false }: {
  userName: string;
  userEmail: string;
  userImage: string | null;
  role: RoleKey;
  /** An L1 operator in an organization they aren't a member of. */
  viaL1?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const initial = userName.trim().slice(0, 1).toUpperCase();

  useEffect(() => {
    const closeOnOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-pine-mist/70"
      >
        <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-clay-mist text-sm font-semibold text-clay" aria-hidden>
          {userImage ? <img src={userImage} alt="" className="h-full w-full object-cover" /> : initial}
        </span>
        <span className="hidden sm:block">
          <span className="block max-w-36 truncate text-sm font-medium text-pine">{userName}</span>
          <span className="block text-xs text-ink/55">{viaL1 ? "L1" : roleLabel(role)}</span>
        </span>
        <ChevronDown className={`hidden h-4 w-4 text-ink/45 transition-transform sm:block ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open ? (
        <div role="menu" className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-72 overflow-hidden rounded-xl border border-pine/15 bg-linen shadow-xl">
          <div className="border-b border-pine/10 px-4 py-4">
            <p className="truncate text-sm font-semibold text-pine">{userName}</p>
            <p className="mt-1 truncate text-xs text-ink/55" title={userEmail}>{userEmail}</p>
            <p className="mt-2 inline-flex rounded-full bg-sage/45 px-2 py-1 text-[11px] font-medium text-pine">{viaL1 ? "L1 · StayOps operator" : role === "owner" ? "Organization owner" : `Team member · ${roleLabel(role)}`}</p>
          </div>
          <div className="p-2">
            <Link href="/settings/profile" role="menuitem" onClick={() => setOpen(false)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink hover:bg-pine-mist hover:text-pine">
              <UserRound className="h-4 w-4" aria-hidden />Profile
            </Link>
            <ConfirmationDialog
              title="Sign out of StayOps?"
              description="You will return to the sign-in page. Any unsaved form changes on this page will be lost."
              confirmLabel="Sign out"
              successMessage={null}
              loadingLabel="Signing you out…"
              onConfirm={signOutAndRedirect}
              trigger={<><LogOut className="h-4 w-4" aria-hidden />Sign out</>}
              triggerRole="menuitem"
              triggerClassName="w-full justify-start text-clay-deep hover:bg-clay-mist/70"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
