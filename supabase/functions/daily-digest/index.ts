// Deno Edge Function, deployed separately from the Next.js app
// (`supabase functions deploy daily-digest`) and scheduled once daily via
// Supabase Dashboard -> Edge Functions -> Cron (see docs/SETUP.md). This is
// the "one Edge Function, scheduled once daily, does three things" job from
// docs/ARCHITECTURE.md "Discord Digest", extended in Milestone 2
// (docs/milestone2/ARCHITECTURE-milestone-2.md) with a second digest pass for
// groups, and again for the in-app notification bell
// (docs/ARCHITECTURE.md "In-App Notifications"):
//   1. delete expired non-recurring events + roll recurring ones forward
//   2. read every user's AND every group's digest preference
//   3. POST a Discord message per opted-in user/group, all concurrently via
//      Promise.all (not a sequential loop) so this doesn't slow down linearly
//      as the number of users/groups grows
//   4. generate in-app notifications (event passed / due today-tomorrow) for
//      every user, independent of Discord digest opt-in - a group event
//      notifies every member, not just whoever created it
//
// Deliberate exception to this project's anon-key-only rule: everywhere else
// (lib/supabase/*.ts) uses the anon key + a user's own session, relying on RLS
// as the real access boundary (docs/ARCHITECTURE_MONOLITH.md). This job has no
// signed-in user - it must read/act across *all* users and groups - so it
// uses the service-role key instead, which bypasses RLS by design. That key
// must never be exposed to the browser; it only ever lives in this function's
// Supabase secrets (`SUPABASE_SERVICE_ROLE_KEY`), never in `.env.local` /
// `NEXT_PUBLIC_*`.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

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

interface GroupSettingsRow {
  group_id: string;
  discord_webhook_url: string;
  groups: { name: string } | null;
}

interface DigestResult {
  sent: boolean;
  failure?: string;
}

// Mirrors lib/dateFormat.ts's dd/mm/yyyy + hh:mm convention - kept as its own
// copy here for the same reason postDiscordMessage below is (this function
// deploys independently on Deno, can't import the Next.js app's modules).
function formatEventLine(event: EventRow, now: Date): string {
  const deadline = new Date(event.deadline);
  const pad = (n: number) => String(n).padStart(2, "0");
  const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / DAY_MS);
  const dayLabel = daysRemaining <= 0 ? "hôm nay" : `còn ${daysRemaining} ngày`;
  const dateLabel = `${DAY_NAMES_VI[deadline.getDay()]}, ${pad(deadline.getDate())}/${pad(deadline.getMonth() + 1)}/${deadline.getFullYear()}, ${pad(deadline.getHours())}:${pad(deadline.getMinutes())}`;
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

/** Personal digests - non-recurring, `group_id is null` (a user's own group-authored
 * events must not leak into their personal digest, same guard as events.repository.ts's
 * listByRecurrence). */
async function sendPersonalDigests(
  supabase: SupabaseClient,
  now: Date,
  weekFromNow: Date,
): Promise<DigestResult[]> {
  const { data: rows, error } = await supabase
    .from("user_settings")
    .select("user_id, discord_webhook_url")
    .eq("digest_enabled", true)
    .not("discord_webhook_url", "is", null);

  if (error) throw new Error(`Reading user_settings failed: ${error.message}`);

  return Promise.all(
    ((rows ?? []) as UserSettingsRow[]).map(async (row): Promise<DigestResult> => {
      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("name, deadline")
        .eq("user_id", row.user_id)
        .is("group_id", null)
        .eq("is_recurring", false)
        .gte("deadline", now.toISOString())
        .lte("deadline", weekFromNow.toISOString())
        .order("deadline", { ascending: true });

      if (eventsError || !events || events.length === 0) return { sent: false };

      const content = [
        "📅 Sắp đến hạn (7 ngày tới):",
        ...(events as EventRow[]).map((event) => formatEventLine(event, now)),
      ].join("\n");

      try {
        await postDiscordMessage(row.discord_webhook_url, content);
        return { sent: true };
      } catch (err) {
        return { sent: false, failure: `user ${row.user_id}: ${err instanceof Error ? err.message : String(err)}` };
      }
    }),
  );
}

/** Group digests (docs/milestone2/ARCHITECTURE-milestone-2.md "Scheduled Daily Job") -
 * every event with that `group_id`, regardless of which member authored it. */
async function sendGroupDigests(
  supabase: SupabaseClient,
  now: Date,
  weekFromNow: Date,
): Promise<DigestResult[]> {
  const { data: rows, error } = await supabase
    .from("group_settings")
    .select("group_id, discord_webhook_url, groups(name)")
    .eq("digest_enabled", true)
    .not("discord_webhook_url", "is", null);

  if (error) throw new Error(`Reading group_settings failed: ${error.message}`);

  return Promise.all(
    ((rows ?? []) as GroupSettingsRow[]).map(async (row): Promise<DigestResult> => {
      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("name, deadline")
        .eq("group_id", row.group_id)
        .eq("is_recurring", false)
        .gte("deadline", now.toISOString())
        .lte("deadline", weekFromNow.toISOString())
        .order("deadline", { ascending: true });

      if (eventsError || !events || events.length === 0) return { sent: false };

      const groupName = row.groups?.name ?? "Group";
      const content = [
        `📅 ${groupName} - Sắp đến hạn (7 ngày tới):`,
        ...(events as EventRow[]).map((event) => formatEventLine(event, now)),
      ].join("\n");

      try {
        await postDiscordMessage(row.discord_webhook_url, content);
        return { sent: true };
      } catch (err) {
        return {
          sent: false,
          failure: `group ${row.group_id}: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }),
  );
}

const ICT_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7 - matches this function's own cron schedule (06:00 ICT)

interface NotificationEventRow {
  id: string;
  name: string;
  user_id: string;
  group_id: string | null;
  deadline: string;
}

interface NotificationInsertRow {
  user_id: string;
  event_id: string;
  type: "event_passed" | "due_soon";
  message: string;
}

/** Personal event -> just its owner; group event -> every member, not just whoever
 * created it (docs/ARCHITECTURE.md "In-App Notifications" - same "everyone's concern,
 * not the creator's alone" rule as equal edit permissions and the shared Discord digest). */
async function resolveRecipients(supabase: SupabaseClient, event: NotificationEventRow): Promise<string[]> {
  if (!event.group_id) return [event.user_id];

  const { data, error } = await supabase.from("group_members").select("user_id").eq("group_id", event.group_id);
  if (error) throw new Error(`Reading group_members failed: ${error.message}`);
  return ((data ?? []) as { user_id: string }[]).map((row) => row.user_id);
}

/** In-app notifications (event passed / due today-tomorrow) for the bell icon -
 * independent of the Discord digest above, sent to every user regardless of whether
 * they've configured a webhook. Dedup is the `notifications` table's own
 * `unique(user_id, event_id, type)` constraint (supabase/schema.sql) - this upserts
 * with `ignoreDuplicates` against it rather than checking existence per row first. */
async function generateNotifications(supabase: SupabaseClient, now: Date): Promise<{ inserted: number }> {
  // Calendar-day boundaries in ICT, not a rolling window - "today"/"tomorrow" are
  // calendar concepts, unlike the digest's own rolling 7-day-from-now window above.
  const nowIct = new Date(now.getTime() + ICT_OFFSET_MS);
  const todayStartIct = Date.UTC(nowIct.getUTCFullYear(), nowIct.getUTCMonth(), nowIct.getUTCDate());
  const todayStart = new Date(todayStartIct - ICT_OFFSET_MS);
  const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);
  const dayAfterTomorrowStart = new Date(todayStart.getTime() + 2 * DAY_MS);

  const [passed, dueSoon] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, user_id, group_id, deadline")
      .eq("is_recurring", false)
      .lt("deadline", now.toISOString()),
    supabase
      .from("events")
      .select("id, name, user_id, group_id, deadline")
      .eq("is_recurring", false)
      .gte("deadline", todayStart.toISOString())
      .lt("deadline", dayAfterTomorrowStart.toISOString()),
  ]);

  if (passed.error) throw new Error(`Reading passed events failed: ${passed.error.message}`);
  if (dueSoon.error) throw new Error(`Reading due-soon events failed: ${dueSoon.error.message}`);

  const rows: NotificationInsertRow[] = [];

  for (const event of (passed.data ?? []) as NotificationEventRow[]) {
    const recipients = await resolveRecipients(supabase, event);
    for (const userId of recipients) {
      rows.push({
        user_id: userId,
        event_id: event.id,
        type: "event_passed",
        message: `"${event.name}" đã qua hạn.`,
      });
    }
  }

  for (const event of (dueSoon.data ?? []) as NotificationEventRow[]) {
    const dayLabel = new Date(event.deadline).getTime() < tomorrowStart.getTime() ? "hôm nay" : "vào ngày mai";
    const recipients = await resolveRecipients(supabase, event);
    for (const userId of recipients) {
      rows.push({
        user_id: userId,
        event_id: event.id,
        type: "due_soon",
        message: `"${event.name}" đến hạn ${dayLabel}.`,
      });
    }
  }

  if (rows.length === 0) return { inserted: 0 };

  const { error } = await supabase
    .from("notifications")
    .upsert(rows, { onConflict: "user_id,event_id,type", ignoreDuplicates: true });

  if (error) throw new Error(`Upserting notifications failed: ${error.message}`);
  return { inserted: rows.length };
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Step 1: reuse the SQL function (supabase/cleanup_and_rollover.sql) instead
  // of re-implementing the delete/rollover math here - keeps that logic in
  // exactly one place. Also handles group events - the function filters purely
  // on is_recurring/deadline, indifferent to group_id.
  const { error: cleanupError } = await supabase.rpc("cleanup_and_roll_events");
  if (cleanupError) {
    return Response.json({ error: `cleanup_and_roll_events failed: ${cleanupError.message}` }, { status: 500 });
  }

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * DAY_MS);

  let results: DigestResult[];
  let notificationsResult: { inserted: number };
  try {
    // Steps 2-4: Discord digests (personal + group) and in-app notifications all run
    // concurrently, not one after the other, so this stays fast as users/groups grow.
    const [personalResults, groupResults, notifications] = await Promise.all([
      sendPersonalDigests(supabase, now, weekFromNow),
      sendGroupDigests(supabase, now, weekFromNow),
      generateNotifications(supabase, now),
    ]);
    results = [...personalResults, ...groupResults];
    notificationsResult = notifications;
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }

  const sent = results.filter((result) => result.sent).length;
  const failures = results.flatMap((result) => (result.failure ? [result.failure] : []));

  return Response.json({ sent, failures, notificationsInserted: notificationsResult.inserted });
});
