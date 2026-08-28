import type { SupabaseClient } from "@supabase/supabase-js";
import { DatabaseError } from "@/modules/shared/errors";
import type { GroupSettingsEntity, GroupSettingsInput } from "@/types/group";

/**
 * All Supabase access for `group_settings` lives here - structurally
 * identical to `modules/settings/settings.repository.ts`, just keyed by
 * `group_id` instead of `user_id` (docs/ARCHITECTURE.md "Group Countdown").
 */
export const groupSettingsRepository = {
  async get(supabase: SupabaseClient, groupId: string): Promise<GroupSettingsEntity | null> {
    const { data, error } = await supabase
      .from("group_settings")
      .select("*")
      .eq("group_id", groupId)
      .maybeSingle();

    if (error) throw new DatabaseError(error.message);
    return data as GroupSettingsEntity | null;
  },

  async upsert(
    supabase: SupabaseClient,
    groupId: string,
    input: GroupSettingsInput,
  ): Promise<GroupSettingsEntity> {
    const { data, error } = await supabase
      .from("group_settings")
      .upsert({ group_id: groupId, ...input }, { onConflict: "group_id" })
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);
    return data as GroupSettingsEntity;
  },
};
