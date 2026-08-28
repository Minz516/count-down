/** A row from the `notifications` table (see docs/ARCHITECTURE.md "In-App Notifications"). */
export type NotificationType = "event_passed" | "due_soon";

/** Repository-internal - see modules/notifications/notifications.dto.ts for the DTO
 * pages/components actually consume. */
export interface NotificationEntity {
  id: string;
  user_id: string;
  event_id: string | null;
  type: NotificationType;
  message: string;
  is_read: boolean;
  /** Set when `is_read` flips to true - the clock for auto-deletion 1 day later, not just a flag. */
  read_at: string | null; // ISO timestamptz
  created_at: string; // ISO timestamptz
}
