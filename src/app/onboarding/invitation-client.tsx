"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthLoadingOverlay } from "@/components/ui/auth-loading-overlay";
import { signOutAndRedirect } from "@/lib/auth/sign-out";
import { acceptInvitationAction } from "./invitation-actions";

export function AcceptInvitationButton({ code, organizationName }: { code: string; organizationName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setPending(true);
    setError(null);
    const result = await acceptInvitationAction(code).catch(() => ({
      error: "We could not process that invitation. Please try again.",
      success: false,
    }));
    if (!result.success) {
      setPending(false);
      setError(result.error ?? "We could not process that invitation. Please try again.");
      toast.error("Couldn’t accept the invitation", { description: result.error });
      return;
    }
    toast.success(`You’ve joined ${organizationName}.`);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {error ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-clay-deep">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
      <Button type="button" variant="clay" size="lg" onClick={accept} disabled={pending}>
        {pending ? "Joining…" : `Join ${organizationName}`}
        {pending ? null : <ArrowRight className="h-4 w-4" aria-hidden />}
      </Button>
      {pending ? <AuthLoadingOverlay label={`Opening ${organizationName}…`} /> : null}
    </div>
  );
}

/** Signs out and returns to login with the invitation still attached. */
export function SwitchAccountButton({ code }: { code: string }) {
  const [pending, setPending] = useState(false);
  async function switchAccount() {
    setPending(true);
    try {
      await signOutAndRedirect(() => window.location.replace(`/login?invite=${encodeURIComponent(code)}`));
    } catch (error) {
      setPending(false);
      toast.error("Couldn’t sign out", { description: error instanceof Error ? error.message : undefined });
    }
  }
  return (
    <Button type="button" variant="ghost" size="lg" onClick={switchAccount} disabled={pending}>
      {pending ? "Signing out…" : "Use a different account"}
    </Button>
  );
}
