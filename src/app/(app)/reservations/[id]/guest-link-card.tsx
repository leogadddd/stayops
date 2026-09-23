"use client";

import { useActionState } from "react";
import { useState } from "react";
import { Check, Copy, Link2, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import {
  createGuestLinkAction,
  revokeGuestLinkAction,
  type GuestLinkFormState,
} from "../actions";

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

/**
 * Guest booking-status link. The raw token exists only in the client state
 * right after creation — it is never persisted or re-shown.
 */
export function GuestLinkCard({
  reservationId,
  activeToken,
}: {
  reservationId: string;
  activeToken: { id: string; createdAt: Date; expiresAt: Date } | null;
}) {
  const [created, createAction, createPending] = useActionState<
    GuestLinkFormState,
    FormData
  >(createGuestLinkAction.bind(null, reservationId), {});
  const [revokeState, revokeAction, revokePending] = useActionState<
    GuestLinkFormState,
    FormData
  >(revokeGuestLinkAction.bind(null, reservationId, activeToken?.id ?? ""), {});

  const [copied, setCopied] = useState(false);
  const shownToken = created.token ?? null;
  const url = shownToken ? `${window.location.origin}/g/${shownToken}` : null;

  async function copyUrl() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink/60">
        A private link the guest can open to see their booking status, dates
        and balance. Creating a new link disables the old one.
      </p>

      {url ? (
        <div className="space-y-2">
          <Label htmlFor="guest-link-url">Link (shown once — copy it now)</Label>
          <div className="flex flex-wrap gap-2">
            <Input id="guest-link-url" readOnly value={url} className="min-w-56 flex-1" />
            <Button type="button" variant="outline" size="md" onClick={copyUrl}>
              {copied ? (
                <>
                  <Check className="h-4 w-4" aria-hidden /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden /> Copy
                </>
              )}
            </Button>
          </div>
        </div>
      ) : null}

      {activeToken ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-pine/10 p-3">
          <p className="text-sm text-ink/70">
            Active link created {formatDateTime(activeToken.createdAt)} · expires{" "}
            {formatDateTime(activeToken.expiresAt)}
          </p>
          <form action={revokeAction}>
            <Button type="submit" variant="ghost" size="sm" disabled={revokePending}>
              <ShieldX className="h-4 w-4" aria-hidden />
              {revokePending ? "Revoking…" : "Revoke link"}
            </Button>
          </form>
        </div>
      ) : (
        <form action={createAction}>
          <Button type="submit" variant="outline" size="md" disabled={createPending}>
            <Link2 className="h-4 w-4" aria-hidden />
            {createPending
              ? "Creating link…"
              : url
                ? "Create another link"
                : "Create guest link"}
          </Button>
        </form>
      )}

      <FieldError message={created.error ?? revokeState.error} />
    </div>
  );
}
