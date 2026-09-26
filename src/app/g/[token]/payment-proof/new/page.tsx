import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { PageHeading } from "@/components/app/page-heading";
import { Card, CardBody } from "@/components/ui/card";
import { getGuestViewByToken } from "@/server/reservations/guest-link";
import { SubmitProofForm } from "../../submit-proof-form";

export const metadata: Metadata = {
  title: "Submit payment reference",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

const PROOF_SUBMISSION_STATUSES = new Set(["hold", "confirmed", "checked_in"]);

export default async function NewGuestPaymentProofPage({ params }: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // The opaque guest token is the only authorization; never require an app session.
  const view = await getGuestViewByToken(token);

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-pine/10 bg-surface">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-4">
          <Logo />
          <span className="text-xs text-ink/50">Guest link</span>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-8">
        {!view ? (
          <Card><CardBody className="py-10 text-center">
            <h1 className="font-display text-2xl text-pine">This link is not valid</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink/60">The link may have expired, been replaced by a newer one, or the address may be incomplete. Please contact your host for an updated link.</p>
          </CardBody></Card>
        ) : (
          <>
            <PageHeading title="Submit payment reference" description={`${view.propertyName} · ${view.unitName}`} backHref={`/g/${encodeURIComponent(token)}`} backLabel="Back to your booking" />
            <Card><CardBody className="space-y-5">
              {PROOF_SUBMISSION_STATUSES.has(view.status) ? (
                <>
                  <p className="rounded-lg bg-sage/40 p-4 text-sm leading-relaxed text-pine">Share the payment reference or sender name. Your host will verify it manually; sending a reference does not change your booking balance.</p>
                  <SubmitProofForm token={token} />
                </>
              ) : (
                <p className="text-sm text-ink/70">Payment references are no longer accepted for this booking. Please contact your host if a payment still needs attention.</p>
              )}
            </CardBody></Card>
            <p className="mt-5 text-center text-xs text-ink/50">Keep your guest link private. Questions? Reply to your host&apos;s message.</p>
          </>
        )}
      </main>
    </div>
  );
}
