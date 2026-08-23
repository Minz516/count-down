import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GroupDashboardClient } from "@/components/GroupDashboardClient";
import { createClient } from "@/lib/supabase/server";
import { eventsInterface } from "@/modules/events/events.interface";
import { groupsInterface, groupSettingsInterface } from "@/modules/groups/groups.interface";
import { todosInterface } from "@/modules/todos/todos.interface";

// Explicit, not just incidental via cookies()'s implicit opt-out - this page renders one
// group's events/todos, scoped by the signed-in user's membership, and must never be
// cached/statically served to another visitor (docs/PRODUCTION_READINESS_CHECKLIST.md §9).
export const dynamic = "force-dynamic";

export default async function GroupDashboardPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;

  const supabase = await createClient();
  // Set by proxy.ts from its own already-verified getUser() call - trusting it here
  // avoids a second Supabase Auth round-trip on every navigation (docs/FIX_NAVIGATION_LATENCY.md).
  const userId = (await headers()).get("x-user-id");

  // Defense in depth - proxy.ts already redirects unauthenticated requests,
  // this guards direct server-render edge cases (e.g. a stale/missing cookie).
  if (!userId) {
    redirect("/login");
  }

  // Same todosInterface.listAllForUser() call the personal dashboard uses (app/page.tsx) -
  // it's already scoped to the viewer's own user_id (docs/milestone3/ARCHITECTURE-milestone-3.md
  // "one thing to verify"), so it naturally covers this group's events too without a
  // group-specific query: each member only ever gets their own todos back, personal or group.
  const [group, { timeline, recurring, nearestEvent }, settings, members, todos] = await Promise.all([
    groupsInterface.getGroup(supabase, groupId),
    eventsInterface.getGroupDashboardData(supabase, groupId),
    groupSettingsInterface.getSettings(supabase, groupId),
    groupsInterface.listGroupMembers(supabase, groupId),
    todosInterface.listAllForUser(supabase, userId),
  ]);

  // RLS returns no row both when the group doesn't exist and when the
  // current user isn't a member of it - those two cases are deliberately
  // indistinguishable to the client (docs/ARCHITECTURE.md "Group Countdown").
  if (!group) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="font-display text-xl font-semibold text-on-surface">Group not found</h1>
        <p className="font-body text-sm text-text-muted">
          This group doesn&apos;t exist, or you&apos;re not a member of it.
        </p>
        <Link href="/groups" className="font-body text-sm text-primary underline underline-offset-4">
          Back to Groups
        </Link>
      </div>
    );
  }

  return (
    <GroupDashboardClient
      group={group}
      currentUserId={userId}
      initialEvents={timeline}
      initialRecurringEvents={recurring}
      initialNearestEvent={nearestEvent}
      initialSettings={settings}
      initialMembers={members}
      initialTodosByEvent={todosInterface.groupByEvent(todos)}
    />
  );
}
