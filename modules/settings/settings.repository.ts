import type { SupabaseClient } from "@supabase/supabase-js";
import { DatabaseError } from "@/modules/shared/errors";
import type { UserSettingsEntity, UserSettingsInput } from "@/types/settings";

/**
 * All Supabase access for the `user_settings` table lives here - nothing
 * outside this module runs a `user_settings` query directly
 * (docs/ARCHITECTURE_DESIGN.md §2.1).
 */
export const settingsRepository = {
  /** `null` is a valid result - a user who hasn't opened Settings yet has no row. */
  async get(supabase: SupabaseClient, userId: string): Promise<UserSettingsEntity | null> {
    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw new DatabaseError(error.message);
    return data as UserSettingsEntity | null;
  },

  async upsert(supabase: SupabaseClient, userId: string, input: UserSettingsInput): Promise<UserSettingsEntity> {
    const { data, error } = await supabase
      .from("user_settings")
      .upsert({ user_id: userId, ...input }, { onConflict: "user_id" })
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);
    return data as UserSettingsEntity;
  },
};
