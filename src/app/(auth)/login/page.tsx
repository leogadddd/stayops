"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthLoadingOverlay } from "@/components/ui/auth-loading-overlay";
import { CircleAlert, MailCheck, Users } from "lucide-react";
import { afterAuthPath, inviteQuery } from "@/lib/auth/invite-redirect";
import { Input, Label } from "@/components/ui/input";

const SESSION_RETRY_MS = 5000;

/**
 * Shown when the server couldn't look up the session (see getSession). Keeps
 * checking in the background and sends the user back into the app as soon as
 * their session is reachable again.
 */
function useSessionRecovery(active: boolean) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    toast.error("We couldn’t load your session", {
      id: "session-unavailable",
      description: "We’ll reconnect you automatically once it’s back.",
      duration: Infinity,
    });

    let stopped = false;
    let timer: number | undefined;

    async function check() {
      const { data, error } = await authClient
        .getSession()
        .catch((error: unknown) => ({ data: null, error }));
      if (stopped) return;
      if (error) {
        timer = window.setTimeout(check, SESSION_RETRY_MS);
        return;
      }
      toast.dismiss("session-unavailable");
      if (data) {
        toast.success("You’re back online.");
        router.replace("/");
        router.refresh();
      } else {
        // The service is reachable but there is no session: sign in as usual.
        router.replace("/login");
      }
    }

    timer = window.setTimeout(check, SESSION_RETRY_MS);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [active, router]);
}

const DEMO_ACCOUNT = {
  email: "owner@stayops.dev",
  password: "stayops-demo-1234",
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const demoRequested = searchParams.get("demo") === "1";
  const invite = searchParams.get("invite");
  useSessionRecovery(searchParams.get("session") === "unavailable");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [demoStarting, setDemoStarting] = useState(false);

  async function signIn(emailAddress: string, passwordValue: string) {
    setError(null);
    setPending(true);
    const { error } = await authClient.signIn.email({
      email: emailAddress,
      password: passwordValue,
    });
    setPending(false);
    if (error) {
      const message = "That email and password combination didn't work.";
      setError(message);
      toast.error("Couldn’t sign in", { description: message });
      return false;
    }
    toast.success("Welcome back.");
    router.push(afterAuthPath(invite, "/"));
    router.refresh();
    return true;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await signIn(email, password);
  }

  function continueWithDemo() {
    setEmail(DEMO_ACCOUNT.email);
    setPassword(DEMO_ACCOUNT.password);
    setDemoStarting(true);
    window.setTimeout(async () => {
      const signedIn = await signIn(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password);
      if (!signedIn) setDemoStarting(false);
    }, 1000);
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-pine">Welcome back</h1>
      <p className="mt-2 text-sm text-ink/60">
        Sign in to your StayOps account.
      </p>
      {invite ? <InvitationNotice /> : null}

      <form
        onSubmit={onSubmit}
        className="mt-10 space-y-6 sm:mt-8 sm:space-y-5"
        noValidate={false}
      >
        {error ? <AuthErrorBanner message={error} /> : null}
        <div>
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@yourproperty.ph"
            className="h-12 px-4 text-base sm:h-10 sm:px-3 sm:text-sm"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password">Password</Label>
          </div>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="h-12 px-4 text-base sm:h-10 sm:px-3 sm:text-sm"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <Button
          type="submit"
          className="h-12 w-full text-base sm:h-10 sm:text-sm"
          disabled={pending}
        >
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-ink/60">
        Don&apos;t have an account?{" "}
        <Link
          href={`/register${inviteQuery(invite)}`}
          className="font-medium text-pine underline underline-offset-4 hover:text-pine-soft"
        >
          Create one
        </Link>
      </p>

      <div className="mt-10 flex items-start gap-3 rounded-xl bg-sage/40 p-4 text-xs leading-relaxed text-ink/70">
        <Users className="mt-px h-4 w-4 shrink-0 text-pine" aria-hidden />
        <p>
          For hosts and their teams. Manage. Coordinate. Keep things moving.
        </p>
      </div>

      {demoRequested && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/55 px-6 py-8">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-mode-title"
            className="w-full max-w-md rounded-2xl bg-paper p-6 shadow-2xl sm:p-8"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pine/60">
              StayOps demo
            </p>
            <h2 id="demo-mode-title" className="mt-3 font-display text-3xl text-pine">
              You&apos;re entering demo mode.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-ink/70">
              You&apos;ll be signed in to our shared sample workspace. Please do
              not add personal, guest, or payment information.
            </p>
            {error && (
              <div className="mt-4"><AuthErrorBanner message={error} /></div>
            )}
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center rounded-lg px-4 text-sm font-medium text-pine hover:bg-pine-mist/70 sm:h-10"
              >
                Go back
              </Link>
              <Button
                type="button"
                className="h-12 text-base sm:h-10 sm:text-sm"
                onClick={continueWithDemo}
                disabled={demoStarting || pending}
              >
                {demoStarting || pending ? "Opening demo…" : "Continue to demo"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {pending || demoStarting ? (
        <AuthLoadingOverlay
          label={demoStarting ? "Opening your demo workspace…" : "Signing you in…"}
        />
      ) : null}
    </div>
  );
}

function InvitationNotice() {
  return (
    <p className="mt-6 flex items-start gap-2 rounded-xl border border-pine/15 bg-sage/35 px-4 py-3 text-sm text-pine">
      <MailCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>Sign in with the email address your invitation was sent to. You’ll review it before joining.</span>
    </p>
  );
}

function AuthErrorBanner({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-clay/25 bg-clay-mist/70 px-4 py-3 text-sm text-clay-deep"
    >
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
