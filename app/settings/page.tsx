import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
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
      <Nav />

      <main id="main" className="content-rise mx-auto flex max-w-[560px] flex-col gap-6 px-4 pt-8 pb-28 sm:px-8 sm:pb-12">
        <h1 className="font-display text-2xl font-semibold text-on-surface">Settings</h1>
        <SettingsForm initialSettings={settings} />
      </main>
    </div>
  );
}
