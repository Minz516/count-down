import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { SettingsForm } from "@/components/SettingsForm";
import { createClient } from "@/lib/supabase/server";
import { settingsInterface } from "@/modules/settings/settings.interface";

// Explicit, not just incidental via cookies()'s implicit opt-out - this page renders one
// signed-in user's own webhook settings and must never be cached/statically served to
// another visitor (docs/PRODUCTION_READINESS_CHECKLIST.md §9).
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  // Set by proxy.ts from its own already-verified getUser() call - trusting it here
  // avoids a second Supabase Auth round-trip on every navigation (docs/FIX_NAVIGATION_LATENCY.md).
  const userId = (await headers()).get("x-user-id");

  // Defense in depth - proxy.ts already redirects unauthenticated requests,
  // this guards direct server-render edge cases (e.g. a stale/missing cookie).
  if (!userId) {
    redirect("/login");
  }

  let settings: Awaited<ReturnType<typeof settingsInterface.getSettings>>;
  try {
    settings = await settingsInterface.getSettings(supabase, userId);
  } catch (error) {
    // See app/page.tsx for why this redirects instead of surfacing the generic
    // Server Component error screen (minified React error #441).
    console.error("SettingsPage: failed to load settings", error);
    redirect("/login");
  }

  return (
    <div className="min-h-dvh">
      <header className="flex h-16 items-center gap-3 border-b border-primary-container/10 px-4 sm:px-12">
        <Link
          href="/"
          aria-label="Back to dashboard"
          className="rounded p-1.5 text-text-muted transition-colors hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
        >
          <ArrowLeft size={20} />
        </Link>
        <span className="font-display text-lg font-semibold text-on-surface">Settings</span>
      </header>

      <main className="mx-auto max-w-[560px] px-4 py-8 sm:px-12">
        <SettingsForm initialSettings={settings} />
      </main>
    </div>
  );
}
