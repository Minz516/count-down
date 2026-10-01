import type { SupabaseClient } from "@supabase/supabase-js";
import { groupsRepository, type GroupWithMembers } from "./groups.repository";
import { toGroupDTO, type GroupDTO, type GroupMemberDTO } from "./groups.dto";
import { profilesInterface } from "@/modules/profiles/profiles.interface";
import { ValidationError } from "@/modules/shared/errors";
import type { ProfileEntity } from "@/types/profile";

const PREVIEW_AVATAR_COUNT = 4;
// Mirrors the `groups_name_length` check constraint added in
// supabase/migrations/20260822000000_production_readiness.sql.
const NAME_MAX_LENGTH = 100;

/** Builds a group's DTO, filling in `preview_avatars` from the already-fetched member rows
 * and a profiles lookup - a repository method only ever touches its own table, so the
 * cross-module composition with `profiles` lives here instead (docs/ARCHITECTURE_DESIGN.md
 * §2.3), same as `toGroupDTO`'s doc comment explains. */
function previewUserIds({ members }: GroupWithMembers): string[] {
  return members.slice(0, PREVIEW_AVATAR_COUNT).map((member) => member.user_id);
}

function toPreviewDTO(entry: GroupWithMembers, profileMap: Map<string, ProfileEntity>): GroupDTO {
  return toGroupDTO(
    entry.group,
    previewUserIds(entry).map((userId) => profileMap.get(userId)?.avatar_url ?? null),
  );
}

export const groupsService = {
  async listGroupsForUser(supabase: SupabaseClient): Promise<GroupDTO[]> {
    const entries = await groupsRepository.listWithMembers(supabase);
    const profileMap = await profilesInterface.getProfilesByIds(
      supabase,
      Array.from(new Set(entries.flatMap(previewUserIds))),
    );
    return entries.map((entry) => toPreviewDTO(entry, profileMap));
  },

  /** A group plus its member roster (docs/UI_SPEC.md "Group Dashboard" - Members) from a
   * single groups query and a single profiles lookup. A member with no `profiles` row
   * (pre-existing account) still appears, just with `username: null`. `group` is `null` when
   * it doesn't exist or the caller isn't a member (RLS makes those indistinguishable). */
  async getGroupWithMembers(
    supabase: SupabaseClient,
    groupId: string,
  ): Promise<{ group: GroupDTO | null; members: GroupMemberDTO[] }> {
    const entry = await groupsRepository.getWithMembers(supabase, groupId);
    if (!entry) return { group: null, members: [] };

    const profileMap = await profilesInterface.getProfilesByIds(
      supabase,
      entry.members.map((member) => member.user_id),
    );

    return {
      group: toPreviewDTO(entry, profileMap),
      members: entry.members.map((member) => {
        const profile = profileMap.get(member.user_id);
        return {
          user_id: member.user_id,
          username: profile?.username ?? null,
          avatar_url: profile?.avatar_url ?? null,
          joined_at: member.joined_at,
        };
      }),
    };
  },

  // createGroup/joinGroup/renameGroup return a GroupDTO with an empty `preview_avatars`
  // (same as before this module had a formal DTO type - none of these three ever
  // populated it) rather than calling attachPreviewAvatars: each caller either only reads
  // `.id`/`.name`/`.invite_code`, or discards the result and calls router.refresh()/
  // router.push() to reload fresh data anyway (components/GroupsListClient.tsx,
  // components/GroupSettingsModal.tsx).
  async createGroup(supabase: SupabaseClient, name: string): Promise<GroupDTO> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new ValidationError("Group name is required.");
    }
    if (trimmed.length > NAME_MAX_LENGTH) {
      throw new ValidationError(`Group name must be ${NAME_MAX_LENGTH} characters or fewer.`);
    }
    return toGroupDTO(await groupsRepository.create(supabase, trimmed), []);
  },

  /**
   * Translates the join_group_by_code() Postgres function's raised
   * exceptions (supabase/schema.sql) into the friendly, typed errors the UI
   * expects (docs/UI_SPEC.md) - a raw Postgres error would otherwise surface
   * as an opaque DatabaseError message.
   */
  async joinGroup(supabase: SupabaseClient, inviteCode: string): Promise<GroupDTO> {
    const trimmed = inviteCode.trim();
    if (!trimmed) {
      throw new ValidationError("Enter an invite code.");
    }

    try {
      return toGroupDTO(await groupsRepository.joinByCode(supabase, trimmed), []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("10-member limit")) {
        throw new ValidationError("This group is full (10 members).");
      }
      if (message.includes("Invalid invite code")) {
        throw new ValidationError("That invite code isn't valid.");
      }
      // Rate limit from join_group_by_code()'s group_join_attempts check
      // (supabase/migrations/20260822000000_production_readiness.sql, docs/
      // PRODUCTION_READINESS_CHECKLIST.md §8) - brute-forcing invite codes.
      if (message.includes("Too many join attempts")) {
        throw new ValidationError("Too many attempts. Please wait a few minutes and try again.");
      }
      throw err;
    }
  },

  /**
   * Renaming is creator-only, enforced by the update_group_name() RPC (supabase/schema.sql)
   * via auth.uid() = created_by. Validation mirrors createGroup's (same NAME_MAX_LENGTH),
   * and the RPC-exception translation mirrors deleteGroup's.
   */
  async renameGroup(supabase: SupabaseClient, groupId: string, name: string): Promise<GroupDTO> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new ValidationError("Group name is required.");
    }
    if (trimmed.length > NAME_MAX_LENGTH) {
      throw new ValidationError(`Group name must be ${NAME_MAX_LENGTH} characters or fewer.`);
    }

    try {
      return toGroupDTO(await groupsRepository.updateName(supabase, groupId, trimmed), []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("Only the group creator can rename this group")) {
        throw new ValidationError("Only the group creator can rename this group.");
      }
      throw err;
    }
  },

  /**
   * Deletion is creator-only, enforced by the delete_group() RPC (supabase/schema.sql)
   * via auth.uid() = created_by - this stays a thin pass-through, same shape as
   * eventsService.deleteEvent, rather than re-checking ownership here. The UI is
   * responsible for only showing the delete action to the creator; this translates
   * the RPC's raised exception into a friendly error for whoever calls it anyway.
   */
  async deleteGroup(supabase: SupabaseClient, groupId: string): Promise<void> {
    try {
      await groupsRepository.remove(supabase, groupId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("Only the group creator can delete this group")) {
        throw new ValidationError("Only the group creator can delete this group.");
      }
      throw err;
    }
  },
};
