import type { SupabaseClient } from "@supabase/supabase-js";
import { notificationsRepository } from "./notifications.repository";
import type { NotificationRecord } from "@/types/notification";

/** Thin passthrough - no business rules beyond what RLS and the table's unique
 * constraint already enforce (docs/ARCHITECTURE.md "In-App Notifications"). */
export const notificationsService = {
  listForUser(supabase: SupabaseClient, userId: string): Promise<NotificationRecord[]> {
    return notificationsRepository.listForUser(supabase, userId);
  },

  markAsRead(supabase: SupabaseClient, userId: string, id: string): Promise<void> {
    return notificationsRepository.markAsRead(supabase, userId, id);
  },

  markAllAsRead(supabase: SupabaseClient, userId: string): Promise<void> {
    return notificationsRepository.markAllAsRead(supabase, userId);
  },

  remove(supabase: SupabaseClient, userId: string, id: string): Promise<void> {
    return notificationsRepository.remove(supabase, userId, id);
  },
};
