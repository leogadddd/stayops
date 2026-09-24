"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
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
    toast.success("Account created", { description: "Let’s set up your organization." });
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-pine">Create your account</h1>
      <p className="mt-2 text-sm text-ink/60">
        Start with one property. Add your organization next.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div>
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            placeholder="Juan Dela Cruz"
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
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
          />
        </div>
        <div>
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            placeholder="Repeat your password"
          />
        </div>

        <FieldError message={error ?? undefined} />

        <Button type="submit" className="w-full" disabled={pending}>
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
