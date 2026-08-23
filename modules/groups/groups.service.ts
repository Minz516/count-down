import type { SupabaseClient } from "@supabase/supabase-js";
import { groupsRepository } from "./groups.repository";
import { profilesInterface } from "@/modules/profiles/profiles.interface";
import { ValidationError } from "@/modules/shared/errors";
import type { GroupRecord, GroupMemberRecord } from "@/types/group";

const PREVIEW_AVATAR_COUNT = 4;
// Mirrors the `groups_name_length` check constraint added in
// supabase/migrations/20260822000000_production_readiness.sql.
const NAME_MAX_LENGTH = 100;

/** Fills in each group's `preview_avatars` from `group_members`/`profiles` - a repository
 * method only ever touches its own table, so the cross-table (and cross-module, for
 * `profiles`) composition lives here instead (docs/ARCHITECTURE_DESIGN.md §2.3). */
async function attachPreviewAvatars(supabase: SupabaseClient, groups: GroupRecord[]): Promise<GroupRecord[]> {
  if (groups.length === 0) return groups;

  const memberRows = await groupsRepository.listMemberRowsForGroups(
    supabase,
    groups.map((group) => group.id),
  );
  const profileMap = await profilesInterface.getProfilesByIds(
    supabase,
    Array.from(new Set(memberRows.map((row) => row.user_id))),
  );

  const rowsByGroup: Record<string, typeof memberRows> = {};
  for (const row of memberRows) {
    (rowsByGroup[row.group_id] ??= []).push(row);
  }

  return groups.map((group) => ({
    ...group,
    preview_avatars: (rowsByGroup[group.id] ?? [])
      .slice(0, PREVIEW_AVATAR_COUNT)
      .map((row) => profileMap.get(row.user_id)?.avatar_url ?? null),
  }));
}

export const groupsService = {
  async listGroupsForUser(supabase: SupabaseClient): Promise<GroupRecord[]> {
    const groups = await groupsRepository.listForUser(supabase);
    return attachPreviewAvatars(supabase, groups);
  },

  async getGroup(supabase: SupabaseClient, groupId: string): Promise<GroupRecord | null> {
    const group = await groupsRepository.getById(supabase, groupId);
    if (!group) return null;
    const [withPreview] = await attachPreviewAvatars(supabase, [group]);
    return withPreview;
  },

  createGroup(supabase: SupabaseClient, name: string): Promise<GroupRecord> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new ValidationError("Group name is required.");
    }
    if (trimmed.length > NAME_MAX_LENGTH) {
      throw new ValidationError(`Group name must be ${NAME_MAX_LENGTH} characters or fewer.`);
    }
    return groupsRepository.create(supabase, trimmed);
  },

  /**
   * Translates the join_group_by_code() Postgres function's raised
   * exceptions (supabase/schema.sql) into the friendly, typed errors the UI
   * expects (docs/UI_SPEC.md) - a raw Postgres error would otherwise surface
   * as an opaque DatabaseError message.
   */
  async joinGroup(supabase: SupabaseClient, inviteCode: string): Promise<GroupRecord> {
    const trimmed = inviteCode.trim();
    if (!trimmed) {
      throw new ValidationError("Enter an invite code.");
    }

    try {
      return await groupsRepository.joinByCode(supabase, trimmed);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("10-member limit")) {
        throw new ValidationError("Nhóm đã đủ 10 thành viên.");
      }
      if (message.includes("Invalid invite code")) {
        throw new ValidationError("Mã mời không hợp lệ.");
      }
      // Rate limit from join_group_by_code()'s group_join_attempts check
      // (supabase/migrations/20260822000000_production_readiness.sql, docs/
      // PRODUCTION_READINESS_CHECKLIST.md §8) - brute-forcing invite codes.
      if (message.includes("Too many join attempts")) {
        throw new ValidationError("Bạn đã thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.");
      }
      throw err;
    }
  },

  /**
   * Renaming is creator-only, enforced by the update_group_name() RPC (supabase/schema.sql)
   * via auth.uid() = created_by. Validation mirrors createGroup's (same NAME_MAX_LENGTH),
   * and the RPC-exception translation mirrors deleteGroup's.
   */
  async renameGroup(supabase: SupabaseClient, groupId: string, name: string): Promise<GroupRecord> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new ValidationError("Group name is required.");
    }
    if (trimmed.length > NAME_MAX_LENGTH) {
      throw new ValidationError(`Group name must be ${NAME_MAX_LENGTH} characters or fewer.`);
    }

    try {
      return await groupsRepository.updateName(supabase, groupId, trimmed);
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

  /** A group's member roster (docs/UI_SPEC.md "Group Dashboard" - Members) - a member with
   * no `profiles` row (pre-existing account) still appears, just with `username: null`. */
  async listGroupMembers(supabase: SupabaseClient, groupId: string): Promise<GroupMemberRecord[]> {
    const rows = await groupsRepository.listMemberRows(supabase, groupId);
    const profileMap = await profilesInterface.getProfilesByIds(
      supabase,
      rows.map((row) => row.user_id),
    );

    return rows.map((row) => {
      const profile = profileMap.get(row.user_id);
      return {
        user_id: row.user_id,
        username: profile?.username ?? null,
        avatar_url: profile?.avatar_url ?? null,
        joined_at: row.joined_at,
      };
    });
  },
};
