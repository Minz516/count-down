import type { SupabaseClient } from "@supabase/supabase-js";
import { settingsRepository } from "./settings.repository";
import { postDiscordMessage, assertValidWebhook } from "./settings.discord";
import { ValidationError } from "@/modules/shared/errors";
import type { UserSettings, UserSettingsInput } from "@/types/settings";

export const settingsService = {
  getSettings(supabase: SupabaseClient, userId: string): Promise<UserSettings | null> {
    return settingsRepository.get(supabase, userId);
  },

  saveSettings(supabase: SupabaseClient, userId: string, input: UserSettingsInput): Promise<UserSettings> {
    assertValidWebhook(input.discord_webhook_url);
    return settingsRepository.upsert(supabase, userId, input);
  },

  async sendTestMessage(webhookUrl: string | null): Promise<void> {
    if (!webhookUrl) {
      throw new ValidationError("Add a webhook URL first.");
    }
    assertValidWebhook(webhookUrl);
    await postDiscordMessage(
      webhookUrl,
      "🔔 This is a test message from Countdown - your daily digest will look like this.",
    );
  },
};
