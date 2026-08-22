import type { SupabaseClient } from "@supabase/supabase-js";
import { DatabaseError } from "@/modules/shared/errors";
import type { GroupRecord } from "@/types/group";

/**
 * All Supabase access for `groups`/`group_members` lives here - nothing
 * outside this module queries those tables directly (docs/ARCHITECTURE_DESIGN.md
 * §2.1). Creating and joining a group both go through `security definer`
 * Postgres functions (`supabase/schema.sql`) rather than raw inserts - neither
 * table has a client-facing insert policy, so `.rpc()` is the only write path.
 */

/** PostgREST's embedded-count aggregate comes back as `[{ count: N }]`, not a bare number. */
interface GroupRow {
  id: string;
  name: string;
  invite_code: string;
  created_by: string | null;
  created_at: string;
  member_count: { count: number }[];
}

function toGroupRecord(row: GroupRow): GroupRecord {
  return {
    id: row.id,
    name: row.name,
    invite_code: row.invite_code,
    created_by: row.created_by,
    created_at: row.created_at,
    member_count: row.member_count[0]?.count ?? 0,
    // Filled in by groups.service.ts's attachPreviewAvatars() - repository
    // methods only touch the `groups` table, not `profiles` too.
    preview_avatars: [],
  };
}

const GROUP_SELECT_WITH_MEMBER_COUNT = "*, member_count:group_members(count)";

interface MemberRow {
  group_id: string;
  user_id: string;
  joined_at: string;
}

export const groupsRepository = {
  /** RLS already scopes `groups` to rows the caller is a member of - no extra filter needed. */
  async listForUser(supabase: SupabaseClient): Promise<GroupRecord[]> {
    const { data, error } = await supabase
      .from("groups")
      .select(GROUP_SELECT_WITH_MEMBER_COUNT)
      .order("created_at", { ascending: true });

    if (error) throw new DatabaseError(error.message);
    return ((data ?? []) as unknown as GroupRow[]).map(toGroupRecord);
  },

  /** `null` covers both "doesn't exist" and "exists but you're not a member" - RLS makes those indistinguishable, which is the point. */
  async getById(supabase: SupabaseClient, groupId: string): Promise<GroupRecord | null> {
    const { data, error } = await supabase
      .from("groups")
      .select(GROUP_SELECT_WITH_MEMBER_COUNT)
      .eq("id", groupId)
      .maybeSingle();

    if (error) throw new DatabaseError(error.message);
    return data ? toGroupRecord(data as unknown as GroupRow) : null;
  },

  async create(supabase: SupabaseClient, name: string): Promise<GroupRecord> {
    const { data, error } = await supabase.rpc("create_group", { p_name: name }).single();
    if (error) throw new DatabaseError(error.message);
    return toGroupRecord({ ...(data as GroupRow), member_count: [{ count: 1 }] });
  },

  async joinByCode(supabase: SupabaseClient, inviteCode: string): Promise<GroupRecord> {
    const { data, error } = await supabase
      .rpc("join_group_by_code", { p_invite_code: inviteCode })
      .single();
    if (error) throw new DatabaseError(error.message);
    // The RPC returns the bare `groups` row (no embedded count) - re-fetch it
    // with the member count filled in for display.
    const group = await groupsRepository.getById(supabase, (data as { id: string }).id);
    if (!group) throw new DatabaseError("Joined the group but couldn't load it back.");
    return group;
  },

  /** Raw membership rows (no profile data) for one group, oldest-joined first. */
  async listMemberRows(supabase: SupabaseClient, groupId: string): Promise<MemberRow[]> {
    const { data, error } = await supabase
      .from("group_members")
      .select("group_id, user_id, joined_at")
      .eq("group_id", groupId)
      .order("joined_at", { ascending: true });

    if (error) throw new DatabaseError(error.message);
    return (data ?? []) as MemberRow[];
  },

  /** Same as above but batched across every group in `groupIds` in one query - used to
   * build each group's avatar preview without a per-card round trip. */
  async listMemberRowsForGroups(supabase: SupabaseClient, groupIds: string[]): Promise<MemberRow[]> {
    if (groupIds.length === 0) return [];

    const { data, error } = await supabase
      .from("group_members")
      .select("group_id, user_id, joined_at")
      .in("group_id", groupIds)
      .order("joined_at", { ascending: true });

    if (error) throw new DatabaseError(error.message);
    return (data ?? []) as MemberRow[];
  },
};
