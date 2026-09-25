"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CircleAlert } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Input, Label } from "@/components/ui/input";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!acceptedTerms) {
      setError("Please agree to the Terms and Conditions to continue.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "");
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    if (password !== confirm) {
      const message = "Passwords don't match.";
      setError(message);
      toast.error("Check your passwords", { description: message });
      return;
    }

    setPending(true);
    const { error } = await authClient.signUp.email({ name, email, password });
    setPending(false);
    if (error) {
      const message =
        error.status === 409
          ? "An account with that email already exists."
          : "We couldn't create your account. Please try again.";
      setError(message);
      toast.error("Couldn’t create your account", { description: message });
      return;
    }
    toast.success("Account created", { description: "Let’s get you set up." });
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-pine">Create your account</h1>
      <p className="mt-2 text-sm text-ink/60">
        Start with one property. Add your organization next.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-10 space-y-6 sm:mt-8 sm:space-y-5"
      >
        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-clay/25 bg-clay-mist/70 px-4 py-3 text-sm text-clay-deep"
          >
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}
        <div>
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            placeholder="Juan Dela Cruz"
            className="h-12 px-4 text-base sm:h-10 sm:px-3 sm:text-sm"
          />
        </div>
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
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            className="h-12 px-4 text-base sm:h-10 sm:px-3 sm:text-sm"
          />
        </div>
        <div>
          <Label htmlFor="confirm">Confirm password</Label>
          <PasswordInput
            id="confirm"
            name="confirm"
            autoComplete="new-password"
            required
            placeholder="Repeat your password"
            className="h-12 px-4 text-base sm:h-10 sm:px-3 sm:text-sm"
          />
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg px-1 py-1 text-sm leading-relaxed text-ink/70">
          <input
            name="acceptedTerms"
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
            required
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-pine/30 text-pine accent-pine focus:ring-2 focus:ring-sage"
          />
          <span>
            I agree to the{" "}
            <Link
              href="/terms"
              className="font-medium text-pine underline underline-offset-4 hover:text-pine-soft"
            >
              Terms and Conditions
            </Link>
            .
          </span>
        </label>

        <Button
          type="submit"
          className="h-12 w-full text-base sm:h-10 sm:text-sm"
          disabled={pending || !acceptedTerms}
        >
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-ink/60">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-pine underline underline-offset-4 hover:text-pine-soft"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
