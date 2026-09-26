"use client";

import { Fragment, useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ClipboardList, Info, KeyRound, MailPlus, Minus, ShieldCheck, UserCog, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonClassName } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { CopyField } from "@/components/ui/copy-field";
import { FieldError, Input, Label } from "@/components/ui/input";
import { SelectMenu } from "@/components/ui/select-menu";
import { TableActionsMenu } from "@/components/ui/table-actions-menu";
import {
  ACTION_LABELS,
  INVITABLE_ROLE_KEYS,
  PERMISSION_ACTIONS,
  PERMISSION_AREAS,
  ROLE_DETAILS,
  ROLE_KEYS,
  roleLabel,
  type InvitableRoleKey,
  type Permission,
  type PermissionAction,
  type RoleKey,
} from "@/lib/permissions";
import {
  changeMemberRoleAction,
  createOrganizationJoinCodeAction,
  inviteStaffAction,
  removeStaffAction,
  reviewOrganizationJoinRequestAction,
  type OrgFormState,
} from "./actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";

const ROLE_ICONS = { admin: ShieldCheck, operations_manager: ClipboardList, staff: UserRound } as const;

const ROLE_OPTIONS = INVITABLE_ROLE_KEYS.map((key) => ({
  value: key,
  label: ROLE_DETAILS[key].name,
  description: ROLE_DETAILS[key].description,
  icon: ROLE_ICONS[key],
}));

function formatExpiry(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeStyle: "short" }).format(new Date(iso));
}

function invitationLink(code: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/onboarding?invite=${encodeURIComponent(code)}`;
}

/** Remounting the form clears the one-time link from the previous invite. */
export function InviteTeamMemberForm() {
  const [round, setRound] = useState(0);
  return <InviteTeamMemberRound key={round} onInviteAnother={() => setRound((value) => value + 1)} />;
}

function InviteTeamMemberRound({ onInviteAnother }: { onInviteAnother: () => void }) {
  const [state, formAction, pending] = useActionState<OrgFormState, FormData>(inviteStaffAction, {});
  const [role, setRole] = useState<InvitableRoleKey>("staff");
  const [email, setEmail] = useState("");
  useActionFeedback(state, { success: "Invitation created." });
  const router = useRouter();
  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  if (state.success && state.invitationCode && state.invitationExpiresAt) {
    return (
      <div className="space-y-5">
        <div role="status" className="flex items-start gap-3 rounded-xl bg-sage/40 p-4 text-sm text-pine">
          <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Invitation created for <strong className="font-semibold">{email}</strong> as{" "}
            <strong className="font-semibold">{roleLabel(role)}</strong>.
          </p>
        </div>
        <CopyField
          label="Invitation link"
          value={invitationLink(state.invitationCode)}
          hint={`Expires ${formatExpiry(state.invitationExpiresAt)}. It only works when signed in as ${email}.`}
        />
        <div className="rounded-xl border border-clay/25 bg-clay-mist/50 p-4 text-sm leading-relaxed text-clay-deep">
          <p className="font-medium">This link is shown only once.</p>
          <p className="mt-1">
            Copy it now and send it to the recipient privately, for example by direct message. Anyone who sees it
            could use it if they also control that email address. If it’s lost, create a new invitation; the
            previous one stops working.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onInviteAnother}>
          <MailPlus className="h-4 w-4" aria-hidden />
          Invite someone else
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <Label htmlFor="invite-email">Email address</Label>
        <Input
          id="invite-email"
          name="email"
          type="email"
          autoComplete="off"
          placeholder="name@example.com"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={state.error ? true : undefined}
          aria-describedby="invite-email-hint"
        />
        <p id="invite-email-hint" className="mt-1.5 text-xs text-ink/55">
          The invitation only works for an account signed in with this exact email address.
        </p>
      </div>
      <div>
        <Label htmlFor="invite-role">Role</Label>
        <SelectMenu id="invite-role" name="role" value={role} onChange={setRole} options={ROLE_OPTIONS} />
        <p className="mt-1.5 text-xs text-ink/55">{ROLE_DETAILS[role].description}</p>
      </div>
      <FieldError message={state.error} />
      <Button type="submit" variant="clay" disabled={pending}>
        <MailPlus className="h-4 w-4" aria-hidden />
        {pending ? "Creating invitation…" : "Invite team member"}
      </Button>
    </form>
  );
}

/**
 * A modal shell shared by the team dialogs: icon, title, description, body,
 * and a footer of actions. Closing is blocked while `pending`.
 */
function TeamDialog({
  dialogRef,
  icon,
  title,
  description,
  pending = false,
  onClose,
  footer,
  size = "md",
  children,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  icon: ReactNode;
  title: string;
  description: ReactNode;
  pending?: boolean;
  onClose?: () => void;
  footer: ReactNode;
  size?: "md" | "lg";
  children?: ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const close = () => {
    if (!pending) dialogRef.current?.close();
  };
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => { if (pending) event.preventDefault(); }}
      onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      className={`fixed left-1/2 top-1/2 m-0 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-pine/15 bg-linen p-0 text-left text-ink shadow-2xl backdrop:bg-pine-deep/55 ${size === "lg" ? "max-w-3xl" : "max-w-lg"}`}
    >
      <div className="flex items-start gap-4 p-6">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sage/60 text-pine">{icon}</span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="font-display text-xl text-pine">{title}</h2>
          <div id={descriptionId} className="mt-2 text-sm leading-relaxed text-ink/65">{description}</div>
          {children}
        </div>
        <button type="button" onClick={close} disabled={pending} aria-label={`Close ${title.toLowerCase()} dialog`} className="rounded-md p-1.5 text-ink/45 hover:bg-pine-mist hover:text-pine disabled:opacity-50">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-pine/10 bg-paper/70 px-6 py-4 sm:flex-row sm:justify-end">{footer}</div>
    </dialog>
  );
}

/** Row menu for a team member: change their role, or remove them. */
export function MemberActions({
  membershipId,
  name,
  role,
  canChangeRole,
  canRemove,
}: {
  membershipId: string;
  name: string;
  role: InvitableRoleKey;
  canChangeRole: boolean;
  canRemove: boolean;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [nextRole, setNextRole] = useState<InvitableRoleKey>(role);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = () => {
    setNextRole(role);
    setError(null);
    dialog.current?.showModal();
  };
  const save = async () => {
    if (nextRole === role) {
      dialog.current?.close();
      return;
    }
    setPending(true);
    setError(null);
    const result = await changeMemberRoleAction(membershipId, nextRole).catch(() => ({ error: "We couldn’t change the role. Try again." }) as OrgFormState);
    setPending(false);
    if (result.error) {
      setError(result.error);
      toast.error("Couldn’t change the role", { description: result.error });
      return;
    }
    toast.success(`${name} is now ${roleLabel(nextRole)}.`);
    dialog.current?.close();
    router.refresh();
  };

  const promoting = INVITABLE_ROLE_KEYS.indexOf(nextRole) < INVITABLE_ROLE_KEYS.indexOf(role);

  return (
    <>
      <TableActionsMenu
        label={name}
        actions={canChangeRole ? [{ label: "Change role", icon: <UserCog className="h-4 w-4" aria-hidden />, onSelect: open }] : []}
        deleteLabel={`Remove ${name}?`}
        deleteDescription="They will lose access to this organization immediately. Their past activity remains in the audit log."
        destructiveActionLabel="Remove"
        deleteSuccessMessage={`${name} was removed.`}
        onDelete={canRemove ? () => removeStaffAction(membershipId) : undefined}
      />
      <TeamDialog
        dialogRef={dialog}
        icon={<UserCog className="h-5 w-5" aria-hidden />}
        title="Change role"
        description={
          <>
            <strong className="font-medium text-ink">{name}</strong> is currently{" "}
            <strong className="font-medium text-ink">{roleLabel(role)}</strong>. They’ll see the change the next time
            they load a page.
          </>
        }
        pending={pending}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => dialog.current?.close()} disabled={pending}>Cancel</Button>
            <Button type="button" variant="clay" onClick={save} disabled={pending || nextRole === role}>
              {pending ? "Saving…" : nextRole === role ? "Save role" : promoting ? `Promote to ${roleLabel(nextRole)}` : `Change to ${roleLabel(nextRole)}`}
            </Button>
          </>
        }
      >
        <ChoiceCards
          aria-label={`New role for ${name}`}
          value={nextRole}
          onChange={setNextRole}
          className="mt-5 sm:grid-cols-1"
          options={ROLE_OPTIONS.map((option) => ({
            ...option,
            label: option.value === role ? `${option.label} · current` : option.label,
            disabled: pending,
          }))}
        />
        {error ? <p className="mt-3 rounded-lg bg-clay-mist px-3 py-2 text-sm text-clay-deep" role="alert">{error}</p> : null}
      </TeamDialog>
    </>
  );
}

/** An info button that opens what every role can do. */
/** An info button that opens what every role can do in this organization. */
export function RolesInfoButton({ matrix, canManage }: { matrix: Record<RoleKey, readonly Permission[]>; canManage: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-label="What each role can do"
        className="inline-flex items-center gap-1 rounded-full bg-pine-mist px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal text-pine hover:bg-sage/70"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
        Roles
      </button>
      <TeamDialog
        dialogRef={dialog}
        size="lg"
        icon={<Info className="h-5 w-5" aria-hidden />}
        title="Roles and permissions"
        description="What each role can do in this organization."
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => dialog.current?.close()}>Close</Button>
            {canManage ? <Link href="/settings/permissions" className={buttonClassName("clay")}>Edit permissions</Link> : null}
          </>
        }
      >
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {ROLE_KEYS.map((key) => (
            <li key={key} className="rounded-lg border border-pine/12 bg-paper/60 p-3">
              <p className="font-medium text-pine">{ROLE_DETAILS[key].name}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink/60">{ROLE_DETAILS[key].description}</p>
            </li>
          ))}
        </ul>
        <div className="mt-5 overflow-x-auto rounded-lg border border-pine/12">
          <table className="w-full min-w-[36rem] text-sm">
            <caption className="sr-only">Permissions by role</caption>
            <thead className="bg-sage/35">
              <tr>
                <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-pine/65">Can…</th>
                {ROLE_KEYS.map((key) => (
                  <th key={key} scope="col" className="px-2 py-2 text-center text-xs font-semibold text-pine/80">{ROLE_DETAILS[key].name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_AREAS.map((group) => (
                <Fragment key={group.area}>
                  <tr className="border-t border-pine/10 bg-paper/60">
                    <th scope="colgroup" colSpan={ROLE_KEYS.length + 1} className="px-3 pb-1 pt-3 text-left text-xs font-semibold text-pine">{group.label}</th>
                  </tr>
                  {PERMISSION_ACTIONS.filter((action) => action in group.actions).map((action) => {
                    const permission = `${group.area}.${action}` as Permission;
                    return (
                      <tr key={permission} className="border-t border-pine/5">
                        <th scope="row" className="px-3 py-1.5 text-left font-normal text-ink/75">
                          <span className="sr-only">{ACTION_LABELS[action]}: </span>
                          {(group.actions as Partial<Record<PermissionAction, string>>)[action]}
                        </th>
                        {ROLE_KEYS.map((key) => {
                          const allowed = matrix[key].includes(permission);
                          return (
                            <td key={key} className="px-2 py-1.5 text-center">
                              {allowed
                                ? <Check className="mx-auto h-4 w-4 text-moss" aria-hidden />
                                : <Minus className="mx-auto h-4 w-4 text-ink/25" aria-hidden />}
                              <span className="sr-only">{allowed ? "Allowed" : "Not allowed"}</span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </TeamDialog>
    </>
  );
}

/** Approve or decline one pending join request, each behind a confirmation. */
export function JoinRequestReview({ requestId, name, roleName }: { requestId: string; name: string; roleName: string }) {
  const router = useRouter();
  const review = (approve: boolean) => async () => {
    const result = await reviewOrganizationJoinRequestAction(requestId, approve);
    if (result.error) throw new Error(result.error);
    router.refresh();
  };
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <ConfirmationDialog
        title={`Approve ${name}?`}
        description={`${name} will join this organization as ${roleName} and can sign in to it right away.`}
        confirmLabel="Approve request"
        successMessage={`${name} can now access this organization.`}
        onConfirm={review(true)}
        trigger={<><Check className="h-4 w-4" aria-hidden />Approve</>}
        triggerVariant="outline"
        triggerSize="sm"
        triggerAriaLabel={`Approve access request from ${name}`}
      />
      <ConfirmationDialog
        title={`Decline ${name}?`}
        description={`${name} will not get access. They can send a new request later if they still have a valid organization join code.`}
        confirmLabel="Decline request"
        successMessage={`Declined ${name}’s request.`}
        onConfirm={review(false)}
        trigger={<><X className="h-4 w-4" aria-hidden />Decline</>}
        triggerSize="sm"
        triggerAriaLabel={`Decline access request from ${name}`}
      />
    </div>
  );
}

/**
 * Generates a reusable organization join code inside a dialog. The code comes
 * back from the server once and is dropped from memory when the dialog closes.
 */
export function JoinCodeControl() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setCode(null);
    setError(null);
  };
  const generate = async () => {
    setPending(true);
    setError(null);
    const result = await createOrganizationJoinCodeAction().catch(() => ({ error: "We couldn’t create a join code. Try again." }) as OrgFormState);
    setPending(false);
    if (result.joinCode) setCode(result.joinCode);
    else setError(result.error ?? "We couldn’t create a join code. Try again.");
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => { reset(); dialog.current?.showModal(); }}>
        <KeyRound className="h-4 w-4" aria-hidden />
        Create join code
      </Button>
      <TeamDialog
        dialogRef={dialog}
        icon={<KeyRound className="h-5 w-5" aria-hidden />}
        title="Organization join code"
        description={
          <>
            Anyone with this code can <strong className="font-medium text-ink">ask</strong> to join as Staff. It does
            not grant access by itself: each request appears under Pending access requests for you to approve or
            decline.
          </>
        }
        pending={pending}
        onClose={reset}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => dialog.current?.close()} disabled={pending}>{code ? "Done" : "Cancel"}</Button>
            {code ? null : (
              <Button type="button" variant="clay" onClick={generate} disabled={pending}>
                {pending ? "Creating…" : "Create code"}
              </Button>
            )}
          </>
        }
      >
        {code ? (
          <div className="mt-5 space-y-3">
            <CopyField label="Join code" value={code} hint="They enter it on the Join an existing organization screen after signing in." />
            <p className="rounded-lg bg-clay-mist/60 px-3 py-2 text-xs leading-relaxed text-clay-deep">
              This code is shown only once and can’t be retrieved later. Share it only with people you expect to
              hear from; you can always decline unknown requests.
            </p>
          </div>
        ) : null}
        {error ? <p className="mt-3 rounded-lg bg-clay-mist px-3 py-2 text-sm text-clay-deep" role="alert">{error}</p> : null}
      </TeamDialog>
    </>
  );
}
