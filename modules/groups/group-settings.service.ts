import type { SupabaseClient } from "@supabase/supabase-js";
import { groupSettingsRepository } from "./group-settings.repository";
import { toGroupSettingsDTO, type GroupSettingsDTO } from "./groups.dto";
import { postDiscordMessage, assertValidWebhook } from "@/modules/settings/settings.interface";
import { ValidationError } from "@/modules/shared/errors";
import type { GroupSettingsInput } from "@/types/group";

export const groupSettingsService = {
  async getSettings(supabase: SupabaseClient, groupId: string): Promise<GroupSettingsDTO | null> {
    const entity = await groupSettingsRepository.get(supabase, groupId);
    return entity ? toGroupSettingsDTO(entity) : null;
  },

  async saveSettings(
    supabase: SupabaseClient,
    groupId: string,
    input: GroupSettingsInput,
  ): Promise<GroupSettingsDTO> {
    assertValidWebhook(input.discord_webhook_url);
    return toGroupSettingsDTO(await groupSettingsRepository.upsert(supabase, groupId, input));
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
