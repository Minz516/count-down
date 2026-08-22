import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
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
      <Nav />

      <main className="mx-auto max-w-[640px] px-4 py-8 sm:px-12">
        <GroupsListClient initialGroups={groups} />
      </main>
    </div>
  );
}
