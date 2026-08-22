import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { GroupsListClient } from "@/components/GroupsListClient";
import { createClient } from "@/lib/supabase/server";
import { authInterface } from "@/modules/auth/auth.interface";
import { groupsInterface } from "@/modules/groups/groups.interface";

export default async function GroupsPage() {
  const supabase = await createClient();
  const user = await authInterface.getCurrentUser(supabase);

  // Defense in depth - proxy.ts already redirects unauthenticated requests,
  // this guards direct server-render edge cases (e.g. a stale/missing cookie).
  if (!user) {
    redirect("/login");
  }

  const groups = await groupsInterface.listGroupsForUser(supabase);

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
        <span className="font-display text-lg font-semibold text-on-surface">Groups</span>
      </header>

      <main className="mx-auto max-w-[640px] px-4 py-8 sm:px-12">
        <GroupsListClient initialGroups={groups} />
      </main>
    </div>
  );
}
