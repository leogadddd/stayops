import Link from "next/link";
import { MailCheck, MailX } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { inspectInvitationAction } from "./invitation-actions";
import { AcceptInvitationButton, SwitchAccountButton } from "./invitation-client";
import { StepNav } from "./step-nav";

/**
 * The primary state of /onboarding?invite=…: who invited them and as what,
 * then one confirmation. Lookups are bound to the signed-in email, so a code
 * meant for someone else reads exactly like an expired one.
 */
export async function InvitationAcceptance({ code, email }: { code: string; email: string }) {
  const form = new FormData();
  form.set("code", code);
  const invitation = await inspectInvitationAction({}, form);

  if (invitation.error || !invitation.organizationName) {
    return (
      <div>
        <MailX className="animate-rise h-10 w-10 text-clay" strokeWidth={1.6} aria-hidden />
        <h1 className="animate-rise mt-5 font-display text-4xl leading-tight text-pine" style={{ animationDelay: "60ms" }}>
          We couldn’t open this invitation
        </h1>
        <p role="alert" className="animate-rise mt-3 max-w-xl text-base leading-relaxed text-ink/65" style={{ animationDelay: "120ms" }}>
          {invitation.error ?? "This invitation is invalid or has expired."}
        </p>
        <div className="animate-rise mt-6 rounded-xl border border-pine/12 bg-linen p-4 text-sm leading-relaxed text-ink/70" style={{ animationDelay: "160ms" }}>
          <p>
            You’re signed in as <strong className="font-medium text-pine">{email}</strong>. Invitations only work for
            the email address they were sent to, and expire after 14 days.
          </p>
          <p className="mt-2">If it was sent to another address, sign in with that account. Otherwise, ask the owner for a new invitation.</p>
        </div>
        <StepNav>
          <Link href="/onboarding" className={buttonClassName("ghost", "lg")}>Continue without invitation</Link>
          <SwitchAccountButton code={code} />
        </StepNav>
      </div>
    );
  }

  return (
    <div>
      <MailCheck className="animate-rise h-10 w-10 text-moss" strokeWidth={1.6} aria-hidden />
      <h1 className="animate-rise mt-5 font-display text-4xl leading-tight text-pine sm:text-5xl" style={{ animationDelay: "60ms" }}>
        Accept your invitation
      </h1>
      <p className="animate-rise mt-3 max-w-xl text-base leading-relaxed text-ink/65" style={{ animationDelay: "120ms" }}>
        You’ve been invited to join a StayOps organization.
      </p>
      <dl className="animate-rise mt-6 grid gap-4 rounded-xl border border-pine/12 bg-linen p-5 text-sm sm:grid-cols-2" style={{ animationDelay: "160ms" }}>
        <div>
          <dt className="text-ink/55">Organization</dt>
          <dd className="mt-1 font-display text-xl text-pine">{invitation.organizationName}</dd>
        </div>
        <div>
          <dt className="text-ink/55">Your role</dt>
          <dd className="mt-1 font-display text-xl text-pine">{invitation.roleName}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-ink/55">Signed in as</dt>
          <dd className="mt-1 text-ink">{email}</dd>
        </div>
      </dl>
      <StepNav>
        <SwitchAccountButton code={code} />
        <AcceptInvitationButton code={code} organizationName={invitation.organizationName} />
      </StepNav>
    </div>
  );
}
