"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Envelope, LockKey } from "@phosphor-icons/react/ssr";
import { createClient } from "@/lib/supabase/client";
import { authInterface } from "@/modules/auth/auth.interface";
import { Button } from "./Button";

interface AuthFormProps {
  mode: "login" | "signup";
}

const COPY = {
  login: {
    title: "Welcome back",
    subtitle: "Please enter your details to continue.",
    submitLabel: "Sign In",
    switchPrompt: "Don't have an account?",
    switchLabel: "Sign Up",
    switchHref: "/signup",
  },
  signup: {
    title: "Create your account",
    subtitle: "Start tracking your deadlines.",
    submitLabel: "Sign Up",
    switchPrompt: "Already have an account?",
    switchLabel: "Sign In",
    switchHref: "/login",
  },
} as const;

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const copy = COPY[mode];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();

    try {
      if (mode === "login") {
        await authInterface.signInWithPassword(supabase, email, password);
      } else {
        await authInterface.signUp(supabase, email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <h1 className="font-display text-2xl font-bold text-on-surface">Countdown</h1>
        <p className="mt-1 font-body text-sm text-text-muted">Quiet Anticipation.</p>
      </div>

      <div className="w-full max-w-sm rounded-lg border border-primary-container/15 bg-surface-container p-6">
        <h2 className="font-display text-lg font-semibold text-on-surface">{copy.title}</h2>
        <p className="mt-1 font-body text-sm text-text-muted">{copy.subtitle}</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-xs font-medium tracking-[0.1em] text-text-muted uppercase">
              Email Address
            </span>
            <div className="flex items-center gap-2 rounded border border-transparent bg-surface-container-lowest px-3 py-2 focus-within:border-primary">
              <Envelope size={18} className="shrink-0 text-text-muted" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                required
                className="w-full bg-transparent font-body text-base text-on-surface placeholder:text-text-muted focus:outline-none"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-xs font-medium tracking-[0.1em] text-text-muted uppercase">
              Password
            </span>
            <div className="flex items-center gap-2 rounded border border-transparent bg-surface-container-lowest px-3 py-2 focus-within:border-primary">
              <LockKey size={18} className="shrink-0 text-text-muted" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="********"
                required
                minLength={6}
                className="w-full bg-transparent font-body text-base text-on-surface placeholder:text-text-muted focus:outline-none"
              />
            </div>
          </label>

          {error && <p className="font-body text-sm text-error">{error}</p>}

          <Button type="submit" disabled={submitting} className="mt-2 w-full">
            {submitting ? "Please wait..." : copy.submitLabel}
          </Button>
        </form>

        <p className="mt-6 text-center font-body text-sm text-text-muted">
          {copy.switchPrompt}{" "}
          <Link href={copy.switchHref} className="text-primary hover:underline">
            {copy.switchLabel}
          </Link>
        </p>
      </div>
    </div>
  );
}
