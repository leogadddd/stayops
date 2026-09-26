"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { selectActiveOrganization } from "@/app/(app)/organization-actions";

export type OrganizationOption = {
  id: string;
  name: string;
  role: "owner" | "staff";
};

export function OrganizationSelector({
  organizations,
  activeOrganizationId,
}: {
  organizations: OrganizationOption[];
  activeOrganizationId: string;
}) {
  const router = useRouter();
  const [switching, startTransition] = useTransition();
  const disabled = organizations.length <= 1 || switching;

  return (
    <label className="flex min-w-0 items-center gap-2 text-pine">
      <Building2 className="h-4 w-4 shrink-0" aria-hidden />
      <span className="sr-only">Active organization</span>
      <select
        aria-label="Active organization"
        value={activeOrganizationId}
        disabled={disabled}
        onChange={(event) => {
          const organizationId = event.target.value;
          startTransition(async () => {
            const result = await selectActiveOrganization(organizationId);
            if (result.error) {
              toast.error("Couldn’t switch organization", { description: result.error });
              return;
            }
            router.push("/dashboard");
            router.refresh();
          });
        }}
        className="min-w-0 max-w-48 truncate bg-transparent py-2 pr-7 text-sm font-semibold text-pine outline-none disabled:cursor-default disabled:appearance-none disabled:pr-0 disabled:opacity-100 sm:max-w-64"
      >
        {organizations.map((organization) => (
          <option key={organization.id} value={organization.id}>
            {organization.name}{organization.role === "staff" ? " (Staff)" : ""}
          </option>
        ))}
      </select>
      {switching ? <span className="text-xs font-medium text-ink/50">Switching…</span> : null}
    </label>
  );
}
