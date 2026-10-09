import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { GroupsListClient } from "@/components/GroupsListClient";
import { createClient } from "@/lib/supabase/server";
import { groupsInterface } from "@/modules/groups/groups.interface";
import { getT } from "@/lib/i18n/server";

// Explicit, not just incidental via cookies()'s implicit opt-out - this page lists one
// signed-in user's own groups and must never be cached/statically served to another
// visitor.
export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const t = await getT();
  const supabase = await createClient();
  // Set by proxy.ts from its own already-verified getUser() call - trusting it here
  // avoids a second Supabase Auth round-trip on every navigation.
  const userId = (await headers()).get("x-user-id");

  // Defense in depth - proxy.ts already redirects unauthenticated requests,
  // this guards direct server-render edge cases (e.g. a stale/missing cookie).
  if (!userId) {
    redirect("/login");
  }

  let groups: Awaited<ReturnType<typeof groupsInterface.listGroupsForUser>>;
  try {
    groups = await groupsInterface.listGroupsForUser(supabase);
  } catch (error) {
    // See app/page.tsx for why this redirects instead of surfacing the generic
    // Server Component error screen (minified React error #441).
    console.error("GroupsPage: failed to load groups", error);
    redirect("/login");
  }

  return (
    <div className="min-h-dvh">
      <Nav />

      <main id="main" className="content-rise mx-auto max-w-[1120px] px-4 pt-8 pb-28 sm:px-8 sm:pb-12 lg:px-12">
        <h1 className="sr-only">{t("groups.title")}</h1>
        <GroupsListClient initialGroups={groups} />
      </main>
    </div>
  );
}
