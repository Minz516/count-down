import type { SupabaseClient } from "@supabase/supabase-js";
import { profilesRepository } from "./profiles.repository";
import { ValidationError } from "@/modules/shared/errors";
import type { ProfileRecord } from "@/types/profile";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB

export const profilesService = {
  getProfile(supabase: SupabaseClient, userId: string): Promise<ProfileRecord | null> {
    return profilesRepository.getProfile(supabase, userId);
  },

  getProfilesByIds(supabase: SupabaseClient, userIds: string[]): Promise<Map<string, ProfileRecord>> {
    return profilesRepository.getProfilesByIds(supabase, userIds);
  },

  async updateProfile(
    supabase: SupabaseClient,
    userId: string,
    input: { username: string; avatar_url: string | null },
  ): Promise<ProfileRecord> {
    const username = input.username.trim();
    if (!username) {
      throw new ValidationError("Username is required.");
    }

    try {
      return await profilesRepository.updateProfile(supabase, userId, { ...input, username });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("Username already taken")) {
        throw new ValidationError("That username is already taken.");
      }
      throw err;
    }
  },

  uploadAvatar(supabase: SupabaseClient, userId: string, file: File): Promise<string> {
    if (!file.type.startsWith("image/")) {
      throw new ValidationError("Please choose an image file.");
    }
    if (file.size > MAX_AVATAR_BYTES) {
      throw new ValidationError("Image must be 2MB or smaller.");
    }
    return profilesRepository.uploadAvatar(supabase, userId, file);
  },
};
