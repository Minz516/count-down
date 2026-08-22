import type { SupabaseClient } from "@supabase/supabase-js";
import { groupsRepository } from "./groups.repository";
import { ValidationError } from "@/modules/shared/errors";
import type { GroupRecord } from "@/types/group";

export const groupsService = {
  listGroupsForUser(supabase: SupabaseClient): Promise<GroupRecord[]> {
    return groupsRepository.listForUser(supabase);
  },

  getGroup(supabase: SupabaseClient, groupId: string): Promise<GroupRecord | null> {
    return groupsRepository.getById(supabase, groupId);
  },

  createGroup(supabase: SupabaseClient, name: string): Promise<GroupRecord> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new ValidationError("Group name is required.");
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
      throw err;
    }
  },
};
