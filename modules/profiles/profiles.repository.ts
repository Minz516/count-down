import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, DatabaseError } from "@/modules/shared/errors";
import type { ProfileEntity } from "@/types/profile";

const AVATAR_BUCKET = "avatars";

/**
 * All Supabase access for `profiles` (and the `avatars` Storage bucket) lives
 * here - nothing outside this module calls `supabase.from("profiles")` or
 * `supabase.storage.from("avatars")` directly.
 */
export const profilesRepository = {
  async getProfile(supabase: SupabaseClient, userId: string): Promise<ProfileEntity | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw new DatabaseError(error.message);
    return data as ProfileEntity | null;
  },

  /** `null` entries in the map mean "no profile row" (a pre-existing account) - callers render a fallback, not an error. */
  async getProfilesByIds(supabase: SupabaseClient, userIds: string[]): Promise<Map<string, ProfileEntity>> {
    if (userIds.length === 0) return new Map();

    const { data, error } = await supabase.from("profiles").select("*").in("id", userIds);
    if (error) throw new DatabaseError(error.message);

    return new Map((data as ProfileEntity[]).map((profile) => [profile.id, profile]));
  },

  async updateProfile(
    supabase: SupabaseClient,
    userId: string,
    input: { username: string; avatar_url: string | null },
  ): Promise<ProfileEntity> {
    const { data, error } = await supabase
      .from("profiles")
      .update(input)
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      // 23505 = unique_violation - modules/profiles/profiles.service.ts translates this
      // into a friendly "username already taken" message, same pattern as the signup
      // trigger's exception in auth.service.ts.
      if (error.code === "23505") {
        throw new AppError("username_taken", "Username already taken");
      }
      throw new DatabaseError(error.message);
    }
    return data as ProfileEntity;
  },

  /** Uploads to a fixed per-user key (`{userId}/avatar`, no extension - contentType is set
   * explicitly instead) so changing your avatar replaces the one object rather than
   * accumulating old files. Returns the public URL. */
  async uploadAvatar(supabase: SupabaseClient, userId: string, file: File): Promise<string> {
    const path = `${userId}/avatar`;
    const { error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (error) throw new AppError("avatar_upload_failed", error.message);

    const {
      data: { publicUrl },
    } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);

    // Cache-bust: the URL itself is stable (fixed key), so a browser/CDN would
    // otherwise keep showing the previous image after an avatar change.
    return `${publicUrl}?v=${Date.now()}`;
  },
};
