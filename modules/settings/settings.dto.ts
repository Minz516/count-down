import type { UserSettingsEntity } from "@/types/settings";

/** The settings module's DTO boundary - see modules/events/events.dto.ts's doc comment
 * for why this is a distinct type + mapper rather than reusing `UserSettingsEntity` directly. */
export interface UserSettingsDTO {
  user_id: string;
  discord_webhook_url: string | null;
  digest_enabled: boolean;
}

export function toUserSettingsDTO(entity: UserSettingsEntity): UserSettingsDTO {
  return { ...entity };
}
