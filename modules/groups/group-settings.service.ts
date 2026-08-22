import type { SupabaseClient } from "@supabase/supabase-js";
import { groupSettingsRepository } from "./group-settings.repository";
import { postDiscordMessage, assertValidWebhook } from "@/modules/settings/settings.interface";
import { ValidationError } from "@/modules/shared/errors";
import type { GroupSettings, GroupSettingsInput } from "@/types/group";

export const groupSettingsService = {
  getSettings(supabase: SupabaseClient, groupId: string): Promise<GroupSettings | null> {
    return groupSettingsRepository.get(supabase, groupId);
  },

  saveSettings(
    supabase: SupabaseClient,
    groupId: string,
    input: GroupSettingsInput,
  ): Promise<GroupSettings> {
    assertValidWebhook(input.discord_webhook_url);
    return groupSettingsRepository.upsert(supabase, groupId, input);
  },

  async sendTestMessage(webhookUrl: string | null): Promise<void> {
    if (!webhookUrl) {
      throw new ValidationError("Add a webhook URL first.");
    }
    assertValidWebhook(webhookUrl);
    await postDiscordMessage(
      webhookUrl,
      "🔔 This is a test message from Countdown - this group's daily digest will look like this.",
    );
  },
};
