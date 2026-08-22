import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { SettingsForm } from "@/components/SettingsForm";
import { createClient } from "@/lib/supabase/server";
import { authInterface } from "@/modules/auth/auth.interface";
import { settingsInterface } from "@/modules/settings/settings.interface";

export default async function SettingsPage() {
  const supabase = await createClient();
  const user = await authInterface.getCurrentUser(supabase);

  // Defense in depth - proxy.ts already redirects unauthenticated requests,
  // this guards direct server-render edge cases (e.g. a stale/missing cookie).
  if (!user) {
    redirect("/login");
  }

  const settings = await settingsInterface.getSettings(supabase, user.id);

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
