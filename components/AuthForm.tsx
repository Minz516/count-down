"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Envelope, Eye, EyeSlash, LockKey, User } from "@phosphor-icons/react/ssr";
import { clsx } from "clsx";
import { createClient } from "@/lib/supabase/client";
import { authInterface } from "@/modules/auth/auth.interface";
import { PASSWORD_REQUIREMENTS } from "@/lib/passwordStrength";
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

const inputWrapClass =
  "flex items-center gap-2 rounded border border-transparent bg-surface-container-lowest px-3 py-2 focus-within:border-primary";
const inputClass =
  "w-full bg-transparent font-body text-base text-on-surface placeholder:text-text-muted focus:outline-none";

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-xs font-medium tracking-[0.1em] text-text-muted uppercase">
        {label}
      </span>
      <div className={inputWrapClass}>
        {icon}
        {children}
      </div>
    </label>
  );
}

/** Password input with a show/hide toggle - used for both Password and Confirm Password. */
function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <Field label={label} icon={<LockKey size={18} className="shrink-0 text-text-muted" />}>
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="********"
        required
        minLength={8}
        autoComplete={autoComplete}
        className={inputClass}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="shrink-0 rounded text-text-muted transition-colors hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
      >
        {visible ? <EyeSlash size={18} /> : <Eye size={18} />}
      </button>
    </Field>
  );
}

/** Live guidance while typing (signup only) - each requirement ticks off as it's met,
 * rather than only surfacing the rule after a failed submit. */
function PasswordRequirementsList({ password }: { password: string }) {
  return (
    <ul className="flex flex-col gap-1">
      {PASSWORD_REQUIREMENTS.map((requirement) => {
        const met = requirement.test(password);
        return (
          <li
            key={requirement.label}
            className={clsx(
              "flex items-center gap-1.5 font-body text-xs transition-colors",
              met ? "text-primary" : "text-text-muted",
            )}
          >
            <span
              aria-hidden
              className={clsx(
                "size-1.5 shrink-0 rounded-full",
                met ? "bg-primary" : "bg-outline-variant",
              )}
            />
            {requirement.label}
          </li>
        );
      })}
    </ul>
  );
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const copy = COPY[mode];

  const [username, setUsername] = useState("");
  const [identifier, setIdentifier] = useState(""); // login: username or email
  const [email, setEmail] = useState(""); // signup only
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();

    try {
      if (mode === "login") {
        await authInterface.signInWithIdentifier(supabase, identifier, password);
      } else {
        await authInterface.signUp(supabase, { username, email, password, confirmPassword });
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
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-3 flex items-center gap-2.5">
          <Image src="/logo.png" alt="" width={36} height={36} className="rounded-lg" />
          <h1 className="font-display text-2xl font-bold text-on-surface">Countdown</h1>
        </div>
        <p className="font-body text-sm text-text-muted">Quiet Anticipation.</p>
      </div>

      <div className="w-full max-w-sm rounded-lg border border-primary-container/15 bg-surface-container p-6">
        <h2 className="font-display text-lg font-semibold text-on-surface">{copy.title}</h2>
        <p className="mt-1 font-body text-sm text-text-muted">{copy.subtitle}</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          {mode === "signup" && (
            <Field label="Username" icon={<User size={18} className="shrink-0 text-text-muted" />}>
              <input
                type="text"
                value={username}
                onChange={(inputEvent) => setUsername(inputEvent.target.value)}
                placeholder="janedoe"
                required
                autoComplete="username"
                className={inputClass}
              />
            </Field>
          )}

          {mode === "signup" ? (
            <Field label="Email Address" icon={<Envelope size={18} className="shrink-0 text-text-muted" />}>
              <input
                type="email"
                value={email}
                onChange={(inputEvent) => setEmail(inputEvent.target.value)}
                placeholder="name@example.com"
                required
                autoComplete="email"
                className={inputClass}
              />
            </Field>
          ) : (
            <Field
              label="Username or Email"
              icon={<User size={18} className="shrink-0 text-text-muted" />}
            >
              <input
                type="text"
                value={identifier}
                onChange={(inputEvent) => setIdentifier(inputEvent.target.value)}
                placeholder="janedoe or name@example.com"
                required
                autoComplete="username"
                className={inputClass}
              />
            </Field>
          )}

          <PasswordField
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />

          {mode === "signup" && (
            <>
              <PasswordRequirementsList password={password} />

              <PasswordField
                label="Confirm Password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
              />
            </>
          )}

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
