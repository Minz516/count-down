// Deno Edge Function, deployed separately from the Next.js app
// (`supabase functions deploy daily-digest`) and scheduled once daily via
// Supabase Dashboard -> Edge Functions -> Cron (see docs/SETUP.md). This is
// the "one Edge Function, scheduled once daily, does three things" job from
// docs/ARCHITECTURE.md "Discord Digest":
//   1. delete expired non-recurring events + roll recurring ones forward
//   2. read every user's digest preference
//   3. POST a Discord message per opted-in user
//
// Deliberate exception to this project's anon-key-only rule: everywhere else
// (lib/supabase/*.ts) uses the anon key + a user's own session, relying on RLS
// as the real access boundary (docs/ARCHITECTURE_MONOLITH.md). This job has no
// signed-in user - it must read/act across *all* users - so it uses the
// service-role key instead, which bypasses RLS by design. That key must never
// be exposed to the browser; it only ever lives in this function's Supabase
// secrets (`SUPABASE_SERVICE_ROLE_KEY`), never in `.env.local` /
// `NEXT_PUBLIC_*`.
import { createClient } from "jsr:@supabase/supabase-js@2";

const DAY_MS = 24 * 60 * 60 * 1000;

const DAY_NAMES_VI = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

interface EventRow {
  name: string;
  deadline: string;
}

interface UserSettingsRow {
  user_id: string;
  discord_webhook_url: string;
}

function formatEventLine(event: EventRow, now: Date): string {
  const deadline = new Date(event.deadline);
  const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / DAY_MS);
  const dayLabel = daysRemaining <= 0 ? "hôm nay" : `còn ${daysRemaining} ngày`;
  const dateLabel = `${DAY_NAMES_VI[deadline.getDay()]}, ${deadline.toLocaleDateString("vi-VN")}`;
  return `• ${event.name} — ${dayLabel} (${dateLabel})`;
}

// Mirrors modules/settings/settings.discord.ts's postDiscordMessage - kept as
// its own small copy here rather than a shared import, since this function is
// deployed independently on the Deno runtime (see file header comment).
async function postDiscordMessage(webhookUrl: string, content: string): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    throw new Error(`Discord rejected the message (status ${response.status}).`);
  }
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Step 1: reuse the SQL function (supabase/cleanup_and_rollover.sql) instead
  // of re-implementing the delete/rollover math here - keeps that logic in
  // exactly one place.
  const { error: cleanupError } = await supabase.rpc("cleanup_and_roll_events");
  if (cleanupError) {
    return Response.json({ error: `cleanup_and_roll_events failed: ${cleanupError.message}` }, { status: 500 });
  }

  // Step 2: everyone who opted in to the digest.
  const { data: settingsRows, error: settingsError } = await supabase
    .from("user_settings")
    .select("user_id, discord_webhook_url")
    .eq("digest_enabled", true)
    .not("discord_webhook_url", "is", null);

  if (settingsError) {
    return Response.json({ error: `Reading user_settings failed: ${settingsError.message}` }, { status: 500 });
  }

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * DAY_MS);
  let sent = 0;
  const failures: string[] = [];

  // Step 3: one digest per opted-in user. Non-recurring only - recurring
  // events already have their own always-visible pinned dashboard section, so
  // the digest stays scoped to the Timeline's "upcoming" set (docs/ARCHITECTURE.md).
  for (const row of (settingsRows ?? []) as UserSettingsRow[]) {
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("name, deadline")
      .eq("user_id", row.user_id)
      .eq("is_recurring", false)
      .gte("deadline", now.toISOString())
      .lte("deadline", weekFromNow.toISOString())
      .order("deadline", { ascending: true });

    if (eventsError || !events || events.length === 0) continue;

    const content = [
      "📅 Sắp đến hạn (7 ngày tới):",
      ...(events as EventRow[]).map((event) => formatEventLine(event, now)),
    ].join("\n");

    try {
      await postDiscordMessage(row.discord_webhook_url, content);
      sent += 1;
    } catch (err) {
      failures.push(`${row.user_id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return Response.json({ sent, failures });
});
