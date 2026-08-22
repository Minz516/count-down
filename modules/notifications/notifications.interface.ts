/**
 * The public contract for the `notifications` module (docs/ARCHITECTURE_DESIGN.md §2.1).
 * Pages and components import from here only - never from notifications.repository.ts
 * or notifications.service.ts directly, and never call `supabase.from("notifications")` themselves.
 */
export { notificationsService as notificationsInterface } from "./notifications.service";
export type { NotificationRecord, NotificationType } from "@/types/notification";
