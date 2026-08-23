import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { GroupsListClient } from "@/components/GroupsListClient";
import { createClient } from "@/lib/supabase/server";
import { groupsInterface } from "@/modules/groups/groups.interface";

// Explicit, not just incidental via cookies()'s implicit opt-out - this page lists one
// signed-in user's own groups and must never be cached/statically served to another
// visitor (docs/PRODUCTION_READINESS_CHECKLIST.md §9).
export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const supabase = await createClient();
  // Set by proxy.ts from its own already-verified getUser() call - trusting it here
  // avoids a second Supabase Auth round-trip on every navigation (docs/FIX_NAVIGATION_LATENCY.md).
  const userId = (await headers()).get("x-user-id");

  // Defense in depth - proxy.ts already redirects unauthenticated requests,
  // this guards direct server-render edge cases (e.g. a stale/missing cookie).
  if (!userId) {
    redirect("/login");
  }

  const groups = await groupsInterface.listGroupsForUser(supabase);

  return (
    <div className="min-h-dvh">
      <Nav />

      <main className="mx-auto max-w-[640px] px-4 py-8 sm:px-12">
        <GroupsListClient initialGroups={groups} />
      </main>
    </div>
  );
}
