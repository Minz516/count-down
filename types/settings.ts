/** A row from the `user_settings` table (see docs/ARCHITECTURE.md). */
export interface UserSettings {
  user_id: string;
  discord_webhook_url: string | null;
  digest_enabled: boolean;
}

/** Fields the Settings form collects; `user_id` is server-assigned. */
export interface UserSettingsInput {
  discord_webhook_url: string | null;
  digest_enabled: boolean;
}
