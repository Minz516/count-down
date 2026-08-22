import type { SupabaseClient } from "@supabase/supabase-js";
import { DatabaseError } from "@/modules/shared/errors";
import type { NotificationRecord } from "@/types/notification";

const RECENT_LIMIT = 50;

/**
 * All Supabase access for `notifications` lives here - nothing outside this
 * module calls `supabase.from("notifications")` directly. Rows are only ever
 * created by the daily-digest Edge Function (service role, bypasses RLS) -
 * there is deliberately no `insert` method here, since the table has no
 * client-facing insert policy for a regular user to use one against.
 */
export const notificationsRepository = {
  async listForUser(supabase: SupabaseClient, userId: string): Promise<NotificationRecord[]> {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(RECENT_LIMIT);

    if (error) throw new DatabaseError(error.message);
    return (data ?? []) as NotificationRecord[];
  },

  async markAsRead(supabase: SupabaseClient, userId: string, id: string): Promise<void> {
    // read_at (not just is_read) is what cleanup_and_roll_events() (supabase/cleanup_and_rollover.sql)
    // uses to auto-delete this row 1 day later.
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw new DatabaseError(error.message);
  },

  async markAllAsRead(supabase: SupabaseClient, userId: string): Promise<void> {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) throw new DatabaseError(error.message);
  },

  async remove(supabase: SupabaseClient, userId: string, id: string): Promise<void> {
    const { error } = await supabase.from("notifications").delete().eq("id", id).eq("user_id", userId);
    if (error) throw new DatabaseError(error.message);
  },
};
