/**
 * The public contract for the `notifications` module.
 * Pages and components import from here only - never from notifications.repository.ts
 * or notifications.service.ts directly, and never call `supabase.from("notifications")` themselves.
 */
export { notificationsService as notificationsInterface } from "./notifications.service";
export type { NotificationDTO, NotificationType } from "./notifications.dto";
