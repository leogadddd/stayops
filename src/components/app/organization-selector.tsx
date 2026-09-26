"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { roleLabel, type RoleKey } from "@/lib/permissions";
import { selectActiveOrganization } from "@/app/(app)/organization-actions";
import { SearchableSelect } from "@/components/ui/timezone-picker";

export type OrganizationOption = {
  id: string;
  name: string;
  role: RoleKey;
  /** Opened through L1 operator access, not a membership. */
  viaL1?: boolean;
  imageSrc?: string | null;
};

/** "Owner", or "L1 access" in an organization the user isn't a member of. */
function accessLabel(organization: Pick<OrganizationOption, "role" | "viaL1">): string {
  return organization.viaL1 ? "L1 access" : roleLabel(organization.role);
}

/** The organization logo, or its initial on brand pine. */
function OrganizationMark({
  name,
  imageSrc,
  size = "md",
  dark = false,
}: {
  name: string;
  imageSrc: string | null;
  size?: "sm" | "md";
  dark?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg font-display",
        dark ? "bg-paper text-pine" : "bg-primary text-white",
        size === "md" ? "h-10 w-10 text-lg" : "h-8 w-8 text-base",
      )}
    >
      {imageSrc ? (
        <img src={imageSrc} alt="" className="h-full w-full object-cover" />
      ) : (
        name.trim().slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

export function OrganizationSelector({
  organizations,
  activeOrganizationId,
  imageSrc,
  tone = "light",
  className,
  onSwitched,
}: {
  organizations: OrganizationOption[];
  activeOrganizationId: string;
  imageSrc: string | null;
  /** `dark` for the pine mobile navigation drawer. */
  tone?: "light" | "dark";
  className?: string;
  onSwitched?: () => void;
}) {
  const dark = tone === "dark";
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [switching, startTransition] = useTransition();
  const activeOrganization =
    organizations.find(
      (organization) => organization.id === activeOrganizationId,
    ) ?? organizations[0]!;
  const disabled = organizations.length <= 1 || switching;

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

  const selectOrganization = (organizationId: string) => {
    if (organizationId === activeOrganizationId) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const result = await selectActiveOrganization(organizationId);
      if (result.error) {
        toast.error("Couldn’t switch organization", {
          description: result.error,
        });
        return;
      }
      setOpen(false);
      onSwitched?.();
      router.push("/dashboard");
      router.refresh();
    });
  };

  const single = organizations.length <= 1;

  if (!dark) {
    return (
      <SearchableSelect
        id="active-organization"
        name="activeOrganization"
        value={activeOrganizationId}
        options={organizations.map((organization) => ({
          value: organization.id,
          label: organization.name,
          description: accessLabel(organization),
          mark: organization.name,
          imageSrc: organization.imageSrc,
        }))}
        placeholder="Select organization"
        searchPlaceholder="Search organizations"
        emptyMessage="No organizations match that search."
        disabled={switching}
        className={cn("w-64", className)}
        onValueChange={selectOrganization}
      />
    );
  }

  return (
    <div ref={root} className={cn("relative min-w-0 ml-0", className)}>
      <button
        type="button"
        aria-label="Active organization"
        aria-haspopup={single ? undefined : "menu"}
        aria-expanded={single ? undefined : open}
        aria-busy={switching}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex min-w-0 items-center gap-2.5 rounded-lg p-1.5 pr-2 text-left transition-colors disabled:cursor-default",
          dark ? "w-full" : "",
          dark
            ? open
              ? "bg-paper/10"
              : "enabled:hover:bg-paper/10"
            : open
              ? "bg-pine-mist"
              : "enabled:hover:bg-pine-mist/70",
        )}
      >
        <OrganizationMark
          name={activeOrganization.name}
          imageSrc={imageSrc}
          dark={dark}
        />
        <span className={cn("min-w-0", dark && "flex-1")}>
          <span
            className={cn(
              "block truncate font-display text-lg leading-tight",
              dark ? "text-paper" : "max-w-36 text-pine sm:max-w-56",
            )}
          >
            {activeOrganization.name}
          </span>
          <span
            className={cn(
              "block text-xs",
              dark ? "text-paper/60" : "text-ink/55",
            )}
          >
            {switching
              ? "Switching…"
              : single
                ? accessLabel(activeOrganization)
                : `${organizations.length} organizations`}
          </span>
        </span>
        {switching ? (
          <LoaderCircle
            className={cn(
              "h-4 w-4 shrink-0 animate-spin",
              dark ? "text-paper/70" : "text-pine/60",
            )}
            aria-hidden
          />
        ) : single ? null : (
          <ChevronsUpDown
            className={cn(
              "h-4 w-4 shrink-0",
              dark ? "text-paper/60" : "text-ink/45",
            )}
            aria-hidden
          />
        )}
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Organizations"
          className={cn(
            "absolute left-0 top-[calc(100%+0.5rem)] z-40 overflow-hidden",
            dark ? "right-0" : "w-80 max-w-[calc(100vw-2rem)]",
            "rounded-xl border border-pine/15 bg-linen shadow-xl",
          )}
        >
          <p className="border-b border-pine/10 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/50">
            Switch organization
          </p>
          <div className="max-h-80 overflow-y-auto p-2">
            {organizations.map((organization) => {
              const selected = organization.id === activeOrganizationId;
              return (
                <button
                  key={organization.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  disabled={switching}
                  onClick={() => selectOrganization(organization.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm disabled:opacity-60",
                    selected ? "bg-pine-mist" : "hover:bg-pine-mist/70",
                  )}
                >
                  <OrganizationMark
                    name={organization.name}
                    imageSrc={organization.imageSrc ?? (selected ? imageSrc : null)}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate",
                        selected
                          ? "font-semibold text-pine"
                          : "font-medium text-ink",
                      )}
                    >
                      {organization.name}
                    </span>
                    <span className="mt-0.5 inline-flex rounded-full bg-sage/45 px-2 py-0.5 text-[11px] font-medium text-pine">
                      {accessLabel(organization)}
                    </span>
                  </span>
                  {selected ? (
                    <Check className="h-4 w-4 shrink-0 text-pine" aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
