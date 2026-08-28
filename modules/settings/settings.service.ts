import type { SupabaseClient } from "@supabase/supabase-js";
import { settingsRepository } from "./settings.repository";
import { postDiscordMessage, assertValidWebhook } from "./settings.discord";
import { toUserSettingsDTO, type UserSettingsDTO } from "./settings.dto";
import { ValidationError } from "@/modules/shared/errors";
import type { UserSettingsInput } from "@/types/settings";

export const settingsService = {
  async getSettings(supabase: SupabaseClient, userId: string): Promise<UserSettingsDTO | null> {
    const entity = await settingsRepository.get(supabase, userId);
    return entity ? toUserSettingsDTO(entity) : null;
  },

  async saveSettings(
    supabase: SupabaseClient,
    userId: string,
    input: UserSettingsInput,
  ): Promise<UserSettingsDTO> {
    assertValidWebhook(input.discord_webhook_url);
    return toUserSettingsDTO(await settingsRepository.upsert(supabase, userId, input));
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
