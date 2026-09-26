"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ACTION_LABELS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_ACTIONS,
  PERMISSION_AREAS,
  ROLE_DETAILS,
  ROLE_KEYS,
  normalizePermissions,
  type Permission,
  type PermissionAction,
  type RoleKey,
} from "@/lib/permissions";
import { saveRolePermissionsAction } from "../actions";
import { SettingsSaveBar } from "../settings-save-bar";

type Matrix = Record<RoleKey, Permission[]>;
type EditableRole = Exclude<RoleKey, "owner">;

const ROWS = PERMISSION_AREAS.map((group) => ({
  area: group.area,
  label: group.label,
  actions: PERMISSION_ACTIONS.filter((action) => action in group.actions).map((action) => ({
    action,
    permission: `${group.area}.${action}` as Permission,
    description: (group.actions as Partial<Record<PermissionAction, string>>)[action]!,
  })),
}));

function sameSet(a: readonly Permission[], b: readonly Permission[]) {
  return a.length === b.length && a.every((permission) => b.includes(permission));
}

/**
 * The organization's permission matrix: one row per action, one column per
 * role. Seeing an area is required for anything else in it, so toggles keep
 * that rule and say so.
 */
export function PermissionMatrixEditor({
  matrix,
  editableRoles,
  actorRole,
}: {
  matrix: Matrix;
  editableRoles: EditableRole[];
  actorRole: RoleKey;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Matrix>(matrix);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [announcement, setAnnouncement] = useState("");

  const dirtyRoles = useMemo(
    () => editableRoles.filter((role) => !sameSet(draft[role], matrix[role])),
    [draft, matrix, editableRoles],
  );

  function toggle(role: EditableRole, permission: Permission, checked: boolean) {
    const [area, action] = permission.split(".");
    const current = new Set(draft[role]);
    if (checked) current.add(permission);
    else if (action === "view") {
      // Without seeing an area nothing else in it makes sense.
      for (const other of current) if (other.startsWith(`${area}.`)) current.delete(other);
    } else current.delete(permission);
    const next = normalizePermissions(current);
    const added = next.filter((p) => !draft[role].includes(p) && p !== permission);
    const removed = draft[role].filter((p) => !next.includes(p) && p !== permission);
    setAnnouncement(
      added.length ? `Also allowed seeing this area for ${ROLE_DETAILS[role].name}.`
        : removed.length ? `Also removed ${removed.length} other ${removed.length === 1 ? "action" : "actions"} in this area for ${ROLE_DETAILS[role].name}.`
          : "",
    );
    setDraft({ ...draft, [role]: next });
  }

  function resetToDefaults(role: EditableRole) {
    setDraft({ ...draft, [role]: [...DEFAULT_ROLE_PERMISSIONS[role]] });
    setAnnouncement(`${ROLE_DETAILS[role].name} reset to the default permissions. Save to apply.`);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    for (const role of dirtyRoles) {
      const result = await saveRolePermissionsAction(role, draft[role]).catch(() => ({ error: "We couldn’t save the permissions. Try again." }));
      if (result.error) {
        setPending(false);
        setError(`${ROLE_DETAILS[role].name}: ${result.error}`);
        toast.error("Couldn’t save permissions", { description: result.error });
        return;
      }
    }
    setPending(false);
    toast.success("Permissions saved. They apply on each member’s next page load.");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="min-w-0 space-y-6 pb-24">
      <Card className="overflow-hidden bg-[#FFFDFA]">
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <h2 className="font-display text-xl text-pine">Role permissions</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink/60">
              Choose what each role can see, create, update and remove in this organization. The Owner always has
              full access. {actorRole === "admin" ? "Only the Owner can change the Admin role." : null}
            </p>
          </div>
          {dirtyRoles.length ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => { setDraft(matrix); setError(undefined); }} disabled={pending}>
              Discard changes
            </Button>
          ) : null}
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <caption className="sr-only">Permissions by role. Each checkbox allows one action for one role.</caption>
            <thead className="bg-sage/35">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-pine/65">Permission</th>
                {ROLE_KEYS.map((role) => {
                  const editable = (editableRoles as RoleKey[]).includes(role);
                  const custom = role !== "owner" && !sameSet(draft[role], DEFAULT_ROLE_PERMISSIONS[role]);
                  return (
                    <th key={role} scope="col" className="w-36 px-2 py-3 text-center align-top">
                      <span className="flex items-center justify-center gap-1 text-xs font-semibold text-pine">
                        {editable ? null : <Lock className="h-3 w-3 text-ink/40" aria-hidden />}
                        {ROLE_DETAILS[role].name}
                      </span>
                      {role === "owner" ? (
                        <span className="mt-1 block text-[11px] font-normal text-ink/50">Always everything</span>
                      ) : !editable ? (
                        <span className="mt-1 block text-[11px] font-normal text-ink/50">Owner only</span>
                      ) : custom ? (
                        <button
                          type="button"
                          onClick={() => resetToDefaults(role as EditableRole)}
                          disabled={pending}
                          className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-clay-deep hover:bg-clay-mist/60"
                          aria-label={`Reset ${ROLE_DETAILS[role].name} to default permissions`}
                        >
                          <RotateCcw className="h-3 w-3" aria-hidden />Reset
                        </button>
                      ) : (
                        <span className="mt-1 block text-[11px] font-normal text-ink/50">Default</span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((group) => (
                <Fragment key={group.area}>
                  <tr className="border-t border-pine/10 bg-paper/60">
                    <th scope="colgroup" colSpan={ROLE_KEYS.length + 1} className="px-4 pb-1.5 pt-4 text-left font-display text-base font-normal text-pine">
                      {group.label}
                    </th>
                  </tr>
                  {group.actions.map(({ action, permission, description }) => (
                    <tr key={permission} className="border-t border-pine/5 hover:bg-paper/50">
                      <th scope="row" className="px-4 py-2.5 text-left font-normal">
                        <span className="block text-xs font-semibold uppercase tracking-wide text-pine/70">{ACTION_LABELS[action]}</span>
                        <span className="block text-ink/70">{description}</span>
                      </th>
                      {ROLE_KEYS.map((role) => {
                        const checked = draft[role].includes(permission);
                        const changed = role !== "owner" && checked !== matrix[role].includes(permission);
                        const editable = (editableRoles as RoleKey[]).includes(role);
                        return (
                          <td key={role} className={cn("px-2 py-2.5 text-center", changed && "bg-clay-mist/40")}>
                            {editable ? (
                              <label className="inline-flex cursor-pointer items-center justify-center rounded-md p-1.5 hover:bg-pine-mist/60">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={pending}
                                  onChange={(event) => toggle(role as EditableRole, permission, event.target.checked)}
                                  className="h-4 w-4 rounded border-pine/30 accent-pine focus-visible:ring-2 focus-visible:ring-sage"
                                  aria-label={`${ROLE_DETAILS[role].name}: ${description}`}
                                />
                                {changed ? <span className="sr-only"> (changed)</span> : null}
                              </label>
                            ) : checked ? (
                              <Check className="mx-auto h-4 w-4 text-moss" aria-label={`${ROLE_DETAILS[role].name}: allowed`} />
                            ) : (
                              <span className="text-ink/25" aria-label={`${ROLE_DETAILS[role].name}: not allowed`}>—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <CardBody className="border-t border-pine/10">
          <p className="text-xs leading-relaxed text-ink/55">
            Changes apply the next time each member loads a page. Seeing an area is required for any other action in
            it, so turning “See” off also turns off the rest of that area. Every change is recorded in the audit log.
          </p>
        </CardBody>
      </Card>
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      <SettingsSaveBar visible={dirtyRoles.length > 0 || pending} pending={pending} error={error} label="Save permissions" />
    </form>
  );
}
