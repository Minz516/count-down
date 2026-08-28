import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/DashboardClient";
import { createClient } from "@/lib/supabase/server";
import { eventsInterface } from "@/modules/events/events.interface";
import { todosInterface } from "@/modules/todos/todos.interface";

// Explicit, not just incidental via cookies()'s implicit opt-out - this page renders one
// signed-in user's own events/todos and must never be cached/statically served to another
// visitor (docs/PRODUCTION_READINESS_CHECKLIST.md §9).
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  // Set by proxy.ts from its own already-verified getUser() call - trusting it here
  // avoids a second Supabase Auth round-trip on every navigation (docs/FIX_NAVIGATION_LATENCY.md).
  const userId = (await headers()).get("x-user-id");

  // Defense in depth - middleware already redirects unauthenticated requests,
  // this guards direct server-render edge cases (e.g. a stale/missing cookie).
  if (!userId) {
    redirect("/login");
  }

  // Two independent queries done once here, same shape as getDashboardData's
  // timeline/recurring split - avoids a per-event-card todos query.
  let dashboardData: Awaited<ReturnType<typeof eventsInterface.getDashboardData>>;
  let todos: Awaited<ReturnType<typeof todosInterface.listAllForUser>>;
  try {
    [dashboardData, todos] = await Promise.all([
      eventsInterface.getDashboardData(supabase, userId),
      todosInterface.listAllForUser(supabase, userId),
    ]);
  } catch (error) {
    // Most likely cause is a session that died between proxy.ts's check and this
    // query (e.g. a JWT that expired in the gap after a long idle period) - send the
    // user back to sign in instead of showing the generic Server Component error
    // screen (minified React error #441).
    console.error("DashboardPage: failed to load dashboard data", error);
    redirect("/login");
  }
  const { timeline, recurring, nearestEvent } = dashboardData;

  return (
    <DashboardClient
      initialEvents={timeline}
      initialRecurringEvents={recurring}
      initialNearestEvent={nearestEvent}
      initialTodosByEvent={todosInterface.groupByEvent(todos)}
    />
  );
}
