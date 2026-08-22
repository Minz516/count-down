import type { SupabaseClient } from "@supabase/supabase-js";
import { settingsRepository } from "./settings.repository";
import { postDiscordMessage } from "./settings.discord";
import { ValidationError } from "@/modules/shared/errors";
import type { UserSettings, UserSettingsInput } from "@/types/settings";

const WEBHOOK_URL_PATTERN = /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//;

/** The field is optional - only validate the shape when the user actually sets one. */
function assertValidWebhook(url: string | null): void {
  if (!url) return;
  if (!WEBHOOK_URL_PATTERN.test(url)) {
    throw new ValidationError("That doesn't look like a Discord webhook URL.");
  }
}

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
