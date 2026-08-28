import type { NotificationEntity, NotificationType } from "@/types/notification";

export type { NotificationType };

/** The notifications module's DTO boundary - see modules/events/events.dto.ts's doc
 * comment for why this is a distinct type + mapper rather than reusing `NotificationEntity`
 * directly. */
export interface NotificationDTO {
  id: string;
  user_id: string;
  event_id: string | null;
  type: NotificationType;
  message: string;
  is_read: boolean;
  read_at: string | null; // ISO timestamptz
  created_at: string; // ISO timestamptz
}

export function toNotificationDTO(entity: NotificationEntity): NotificationDTO {
  return { ...entity };
}

export function toNotificationDTOs(entities: NotificationEntity[]): NotificationDTO[] {
  return entities.map(toNotificationDTO);
}
