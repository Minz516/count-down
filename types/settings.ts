/** A row from the `user_settings` table (see docs/ARCHITECTURE.md). Repository-internal -
 * see modules/settings/settings.dto.ts for the DTO pages/components actually consume. */
export interface UserSettingsEntity {
  user_id: string;
  discord_webhook_url: string | null;
  digest_enabled: boolean;
}

/** Fields the Settings form collects; `user_id` is server-assigned. */
export interface UserSettingsInput {
  discord_webhook_url: string | null;
  digest_enabled: boolean;
}
