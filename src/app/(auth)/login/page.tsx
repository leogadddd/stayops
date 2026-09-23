"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    setPending(false);
    if (error) {
      setError("That email and password combination didn't work.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-pine">Welcome back</h1>
      <p className="mt-2 text-sm text-ink/60">
        Sign in to your StayOps account.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate={false}>
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
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password">Password</Label>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
          />
        </div>

        <FieldError message={error ?? undefined} />

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-ink/60">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-pine underline underline-offset-4 hover:text-pine-soft"
        >
          Create one
        </Link>
      </p>

      <div className="mt-10 flex items-start gap-3 rounded-xl bg-sage/40 p-4 text-xs leading-relaxed text-ink/70">
        <span aria-hidden>◱</span>
        <p>
          For hosts and their teams. Manage. Coordinate. Keep things moving.
        </p>
      </div>
    </div>
  );
}
