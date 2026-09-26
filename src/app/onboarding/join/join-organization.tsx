"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock3, RefreshCw } from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { requestOrganizationAccessAction, type InvitationActionState } from "../invitation-actions";
import { StepNav } from "../step-nav";

type PendingRequest = { id: string; organizationName: string; requestedAt: string };

function formatRequested(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

/**
 * Join by organization code. Sending a code only creates a request; the user
 * stays outside the app until an owner approves it.
 */
export function JoinOrganization({
  hasMembership,
  pendingRequests,
}: {
  hasMembership: boolean;
  pendingRequests: PendingRequest[];
}) {
  const [enteringCode, setEnteringCode] = useState(pendingRequests.length === 0);
  const [round, setRound] = useState(0);
  const showPending = useCallback(() => setEnteringCode(false), []);

  if (!enteringCode && pendingRequests.length > 0) {
    return <PendingApproval requests={pendingRequests} onEnterDifferentCode={() => { setRound((value) => value + 1); setEnteringCode(true); }} />;
  }
  return (
    <JoinCodeForm
      key={round}
      hasMembership={hasMembership}
      onRequested={showPending}
      onCancel={pendingRequests.length > 0 ? showPending : undefined}
    />
  );
}

function JoinCodeForm({
  hasMembership,
  onRequested,
  onCancel,
}: {
  hasMembership: boolean;
  onRequested: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<InvitationActionState, FormData>(requestOrganizationAccessAction, {});
  useActionFeedback(state, { success: "Request sent to the owner.", errorTitle: "Couldn’t send your request" });
  useEffect(() => {
    if (!state.success) return;
    onRequested();
    router.refresh();
  }, [state.success, onRequested, router]);

  return (
    <form action={formAction}>
      <h1 className="animate-rise font-display text-4xl text-pine">Join an existing organization</h1>
      <p className="animate-rise mt-3 max-w-xl text-sm leading-relaxed text-ink/60" style={{ animationDelay: "120ms" }}>
        Enter the organization join code the owner shared with you. This sends them a request; you’ll get access once
        they approve it.
      </p>
      {hasMembership ? (
        <p className="mt-4 text-sm text-ink/60">
          You already belong to an organization.{" "}
          <Link href="/dashboard" className="font-medium text-pine underline underline-offset-4">Go to your dashboard</Link>
        </p>
      ) : null}
      <div className="animate-rise mt-8" style={{ animationDelay: "180ms" }}>
        <Label htmlFor="join-code">Organization join code</Label>
        <Input
          id="join-code"
          name="code"
          required
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus
          placeholder="Paste the code here"
          aria-invalid={state.error ? true : undefined}
          className="h-12 px-4 font-mono text-base"
        />
        <FieldError message={state.error} />
      </div>
      <StepNav backHref={onCancel ? undefined : "/onboarding"}>
        {onCancel ? <Button type="button" variant="ghost" size="lg" onClick={onCancel}>Cancel</Button> : null}
        <Button type="submit" variant="clay" size="lg" disabled={pending}>
          {pending ? "Sending request…" : "Request access"}
          {pending ? null : <ArrowRight className="h-4 w-4" aria-hidden />}
        </Button>
      </StepNav>
    </form>
  );
}

function PendingApproval({ requests, onEnterDifferentCode }: { requests: PendingRequest[]; onEnterDifferentCode: () => void }) {
  const router = useRouter();
  const [checking, startChecking] = useTransition();

  return (
    <div>
      <Clock3 className="animate-rise h-10 w-10 text-clay" strokeWidth={1.6} aria-hidden />
      <h1 className="animate-rise mt-5 font-display text-4xl leading-tight text-pine" style={{ animationDelay: "60ms" }}>
        Waiting for approval
      </h1>
      <p className="animate-rise mt-3 max-w-xl text-base leading-relaxed text-ink/65" style={{ animationDelay: "120ms" }}>
        The owner needs to approve your request before you can use StayOps with their team. You’re not a member yet.
      </p>
      <ul className="animate-rise mt-6 space-y-2" style={{ animationDelay: "160ms" }} aria-label="Pending requests">
        {requests.map((request) => (
          <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-pine/12 bg-linen px-4 py-3 text-sm">
            <span className="font-medium text-pine">{request.organizationName}</span>
            <span className="text-ink/55">
              Status: pending · requested <time dateTime={request.requestedAt}>{formatRequested(request.requestedAt)}</time>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-ink/55" role="status" aria-live="polite">
        {checking ? "Checking status…" : "Come back to this page any time; you’ll be able to open the organization once approved."}
      </p>
      <StepNav backHref="/onboarding">
        <Button type="button" variant="ghost" size="lg" onClick={onEnterDifferentCode}>Enter a different code</Button>
        <button
          type="button"
          className={buttonClassName("outline", "lg")}
          disabled={checking}
          onClick={() => startChecking(() => router.refresh())}
        >
          <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} aria-hidden />
          Check status
        </button>
      </StepNav>
    </div>
  );
}
