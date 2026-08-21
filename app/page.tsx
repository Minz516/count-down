import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/DashboardClient";
import { createClient } from "@/lib/supabase/server";
import type { EventRecord } from "@/types/event";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defense in depth - middleware already redirects unauthenticated requests,
  // this guards direct server-render edge cases (e.g. a stale/missing cookie).
  if (!user) {
    redirect("/login");
  }

  // Two independent queries per docs/ARCHITECTURE.md: the Timeline never includes
  // recurring events, and the recurring section never joins the Timeline's sort order.
  const [{ data: events }, { data: recurringEvents }] = await Promise.all([
    supabase.from("events").select("*").eq("is_recurring", false).order("deadline", { ascending: true }),
    supabase.from("events").select("*").eq("is_recurring", true).order("deadline", { ascending: true }),
  ]);

  return (
    <DashboardClient
      initialEvents={(events ?? []) as EventRecord[]}
      initialRecurringEvents={(recurringEvents ?? []) as EventRecord[]}
    />
  );
}
