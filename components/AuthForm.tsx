"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DiscordLogo,
  Envelope,
  Eye,
  EyeSlash,
  FacebookLogo,
  GithubLogo,
  GoogleLogo,
  LockKey,
  User,
} from "@phosphor-icons/react/ssr";
import { clsx } from "clsx";
import { createClient } from "@/lib/supabase/client";
import { authInterface, type OAuthProvider } from "@/modules/auth/auth.interface";
import { PASSWORD_REQUIREMENTS } from "@/lib/passwordStrength";
import { Button } from "./Button";
import { LanguageButton } from "./LanguageToggle";
import { useT } from "./LocaleProvider";
import { ThemeIconButton } from "./ThemeToggle";

const OAUTH_PROVIDERS: { provider: OAuthProvider; label: string; icon: React.ReactNode }[] = [
  { provider: "google", label: "Google", icon: <GoogleLogo aria-hidden="true" size={18} /> },
  { provider: "facebook", label: "Facebook", icon: <FacebookLogo aria-hidden="true" size={18} /> },
  { provider: "discord", label: "Discord", icon: <DiscordLogo aria-hidden="true" size={18} /> },
  { provider: "github", label: "GitHub", icon: <GithubLogo aria-hidden="true" size={18} /> },
];

interface AuthFormProps {
  mode: "login" | "signup";
}

const COPY = {
  login: {
    title: "auth.signIn.title",
    subtitle: "auth.signIn.subtitle",
    submitLabel: "auth.signIn.submit",
    switchPrompt: "auth.signIn.switchPrompt",
    switchLabel: "auth.signIn.switchLabel",
    switchHref: "/signup",
  },
  signup: {
    title: "auth.signUp.title",
    subtitle: "auth.signUp.subtitle",
    submitLabel: "auth.signUp.submit",
    switchPrompt: "auth.signUp.switchPrompt",
    switchLabel: "auth.signUp.switchLabel",
    switchHref: "/login",
  },
} as const;

const inputWrapClass =
  "flex min-h-11 items-center gap-2 rounded border border-field-border bg-surface-container-lowest px-3 py-2 focus-within:border-primary focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-primary/50";
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
  const t = useT();
  const [visible, setVisible] = useState(false);

  return (
    <Field label={label} icon={<LockKey aria-hidden="true" size={18} className="shrink-0 text-text-muted" />}>
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("auth.placeholder.password")}
        name={autoComplete === "new-password" ? "new-password" : "password"}
        required
        minLength={8}
        autoComplete={autoComplete}
        className={inputClass}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
        className="shrink-0 rounded p-2 text-text-muted transition-colors hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
      >
        {visible ? <EyeSlash aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
      </button>
    </Field>
  );
}

/** Live guidance while typing (signup only) - each requirement ticks off as it's met,
 * rather than only surfacing the rule after a failed submit. */
function PasswordRequirementsList({ password }: { password: string }) {
  const t = useT();
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
            {t.text(requirement.label)}
          </li>
        );
      })}
    </ul>
  );
}

export function AuthForm({ mode }: AuthFormProps) {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const copy = COPY[mode];

  const [username, setUsername] = useState("");
  const [identifier, setIdentifier] = useState(""); // login: username or email
  const [email, setEmail] = useState(""); // signup only
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Seeded from app/auth/callback/route.ts's ?error=oauth_failed redirect - a plain useState
  // initializer (not an effect) since it only needs to reflect the URL once, on mount.
  const [error, setError] = useState<string | null>(() =>
    searchParams.get("error") === "oauth_failed" ? t("auth.oauthFailed") : null,
  );
  const [submitting, setSubmitting] = useState(false);
  // Set instead of redirecting when Supabase Auth's "Confirm email" setting is on:
  // signUp() then returns no session until
  // the confirmation link is clicked, so pushing to "/" would just get bounced back to
  // /login by proxy.ts with no explanation.
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();

    try {
      if (mode === "login") {
        await authInterface.signInWithIdentifier(supabase, identifier, password);
      } else {
        const { hasSession } = await authInterface.signUp(supabase, {
          username,
          email,
          password,
          confirmPassword,
        });
        if (!hasSession) {
          setNeedsEmailConfirmation(true);
          setSubmitting(false);
          return;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? t.text(err.message) : t("error.generic"));
      setSubmitting(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleOAuth(provider: OAuthProvider) {
    setError(null);
    const supabase = createClient();
    try {
      // Navigates the browser away to the provider's consent screen on success - no
      // further redirect/loading-state handling needed here.
      await authInterface.signInWithOAuth(supabase, provider, `${window.location.origin}/auth/callback`);
    } catch (err) {
      setError(err instanceof Error ? t.text(err.message) : t("error.generic"));
    }
  }

  return (
    <main id="main" className="relative flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="absolute top-3 right-3 flex items-center gap-1 sm:top-5 sm:right-6">
        <LanguageButton />
        <ThemeIconButton />
      </div>
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-3 flex items-center gap-2.5">
          <Image src="/logo.png" alt="" width={36} height={36} priority className="rounded-lg" />
          <h1 translate="no" className="font-display text-2xl font-bold tracking-tight text-on-surface">Countdown</h1>
        </div>
        <p className="font-body text-sm text-text-muted">{t("auth.tagline")}</p>
      </div>

      <div className="w-full max-w-sm rounded-lg border border-primary-container/15 bg-surface-container p-6">
        {needsEmailConfirmation ? (
          <>
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary-container/15 text-primary">
                <Envelope aria-hidden="true" size={24} />
              </span>
              <div>
                <h2 className="text-balance font-display text-lg font-semibold text-on-surface">{t("auth.checkEmail.title")}</h2>
                <p className="mt-1 font-body text-sm text-text-muted">
                  {t("auth.checkEmail.before")} <span className="text-on-surface">{email}</span>.{" "}
                  {t("auth.checkEmail.after")}
                </p>
              </div>
            </div>
            <Link href="/login" className="mt-6 block">
              <Button type="button" className="w-full">
                {t("auth.backToSignIn")}
              </Button>
            </Link>
          </>
        ) : (
          <>
            <h2 className="text-balance font-display text-lg font-semibold text-on-surface">{t(copy.title)}</h2>
            <p className="mt-1 font-body text-sm text-text-muted">{t(copy.subtitle)}</p>

            <div className="mt-6 grid grid-cols-2 gap-2">
              {OAUTH_PROVIDERS.map(({ provider, label, icon }) => (
                <Button
                  key={provider}
                  type="button"
                  variant="ghost"
                  onClick={() => handleOAuth(provider)}
                  className="gap-1.5"
                >
                  {icon}
                  {label}
                </Button>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-outline-variant" />
              <span className="font-mono text-xs text-text-muted uppercase">{t("auth.or")}</span>
              <span className="h-px flex-1 bg-outline-variant" />
            </div>

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          {mode === "signup" && (
            <Field label={t("common.username")} icon={<User aria-hidden="true" size={18} className="shrink-0 text-text-muted" />}>
              <input
                type="text"
                value={username}
                onChange={(inputEvent) => setUsername(inputEvent.target.value)}
                placeholder="janedoe…"
                name="username"
                spellCheck={false}
                autoCapitalize="none"
                required
                autoComplete="username"
                className={inputClass}
              />
            </Field>
          )}

          {mode === "signup" ? (
            <Field label={t("auth.field.email")} icon={<Envelope aria-hidden="true" size={18} className="shrink-0 text-text-muted" />}>
              <input
                type="email"
                value={email}
                onChange={(inputEvent) => setEmail(inputEvent.target.value)}
                placeholder="name@example.com…"
                name="email"
                inputMode="email"
                spellCheck={false}
                autoCapitalize="none"
                required
                autoComplete="email"
                className={inputClass}
              />
            </Field>
          ) : (
            <Field
              label={t("auth.field.identifier")}
              icon={<User aria-hidden="true" size={18} className="shrink-0 text-text-muted" />}
            >
              <input
                type="text"
                value={identifier}
                onChange={(inputEvent) => setIdentifier(inputEvent.target.value)}
                placeholder="janedoe or name@example.com…"
                name="identifier"
                spellCheck={false}
                autoCapitalize="none"
                required
                autoComplete="username"
                className={inputClass}
              />
            </Field>
          )}

          <PasswordField
            label={t("auth.field.password")}
            value={password}
            onChange={setPassword}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />

          {mode === "signup" && (
            <>
              <PasswordRequirementsList password={password} />

              <PasswordField
                label={t("auth.field.confirmPassword")}
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
              />
            </>
          )}

          {error && <p role="alert" className="font-body text-sm text-error">{error}</p>}

          <Button type="submit" disabled={submitting} className="mt-2 w-full">
            {submitting ? t("common.pleaseWait") : t(copy.submitLabel)}
          </Button>
        </form>

            <p className="mt-6 text-center font-body text-sm text-text-muted">
              {t(copy.switchPrompt)}{" "}
              <Link href={copy.switchHref} className="text-primary underline underline-offset-2 hover:text-on-surface">
                {t(copy.switchLabel)}
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
