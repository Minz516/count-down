import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/DashboardClient";
import { createClient } from "@/lib/supabase/server";
import { authInterface } from "@/modules/auth/auth.interface";
import { eventsInterface } from "@/modules/events/events.interface";
import { todosInterface } from "@/modules/todos/todos.interface";

// Explicit, not just incidental via cookies()'s implicit opt-out - this page renders one
// signed-in user's own events/todos and must never be cached/statically served to another
// visitor (docs/PRODUCTION_READINESS_CHECKLIST.md §9).
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const user = await authInterface.getCurrentUser(supabase);

  // Defense in depth - middleware already redirects unauthenticated requests,
  // this guards direct server-render edge cases (e.g. a stale/missing cookie).
  if (!user) {
    redirect("/login");
  }

  // Two independent queries done once here, same shape as getDashboardData's
  // timeline/recurring split - avoids a per-event-card todos query.
  const [{ timeline, recurring, nearestEvent }, todos] = await Promise.all([
    eventsInterface.getDashboardData(supabase, user.id),
    todosInterface.listAllForUser(supabase, user.id),
  ]);

  return (
    <DashboardClient
      initialEvents={timeline}
      initialRecurringEvents={recurring}
      initialNearestEvent={nearestEvent}
      initialTodosByEvent={todosInterface.groupByEvent(todos)}
    />
  );
}
