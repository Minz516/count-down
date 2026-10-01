import type { SupabaseClient } from "@supabase/supabase-js";
import { DatabaseError } from "@/modules/shared/errors";
import type { GroupEntity } from "@/types/group";

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
  members: MemberRow[];
}

/** Normalizes PostgREST's raw embedded-count wire shape into the flat entity - `preview_avatars`
 * isn't part of this at all: it's filled in only in `GroupDTO`, by groups.service.ts's
 * attachPreviewAvatars() (a cross-module join with `profiles` that a repository, scoped to
 * its own table, never does - docs/ARCHITECTURE_DESIGN.md §2.1). */
function toGroupEntity(row: GroupRow): GroupEntity {
  return {
    id: row.id,
    name: row.name,
    invite_code: row.invite_code,
    created_by: row.created_by,
    created_at: row.created_at,
    member_count: row.member_count[0]?.count ?? 0,
  };
}

const GROUP_SELECT_WITH_MEMBER_COUNT = "*, member_count:group_members(count)";
// Same table family, so the membership rows ride along in the groups query (one round trip)
// instead of a second group_members query after it.
const GROUP_SELECT_WITH_MEMBERS = `${GROUP_SELECT_WITH_MEMBER_COUNT}, members:group_members(user_id, joined_at)`;

/** Raw membership row (no profile data). */
export interface MemberRow {
  user_id: string;
  joined_at: string;
}

export interface GroupWithMembers {
  group: GroupEntity;
  /** Oldest-joined first. */
  members: MemberRow[];
}

/** A member as returned by the group_with_members functions: membership plus profile in one row. */
export interface MemberWithProfile extends MemberRow {
  username: string | null;
  avatar_url: string | null;
}

export interface GroupWithMemberProfiles {
  group: GroupEntity;
  /** Oldest-joined first. */
  members: MemberWithProfile[];
}

/** `available: false` means the SQL functions are not installed yet (see below), so the caller
 * falls back to the two-call path. A real failure still throws. */
export type RpcResult<T> = { available: true; value: T } | { available: false };

// supabase/migrations/20261002000000_group_with_members_rpc.sql adds two read-only functions that
// return a group, its members and their profiles in ONE round trip. PostgREST answers PGRST202 (or
// Postgres 42883) while they are missing. The "missing" verdict is remembered briefly so a deploy
// that precedes the migration does not pay for a failing call on every request, and expires so a
// long-lived server notices the migration without a restart.
const RPC_MISSING_RETRY_MS = 60_000;
let rpcMissingUntil = 0;

/** Test hook: forget a remembered "functions are missing" verdict. */
export function resetGroupRpcAvailability() {
  rpcMissingUntil = 0;
}

async function callGroupRpc<T>(
  supabase: SupabaseClient,
  fn: "list_groups_with_members" | "get_group_with_members",
  args: Record<string, unknown>,
): Promise<RpcResult<T>> {
  if (Date.now() < rpcMissingUntil) return { available: false };

  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") {
      rpcMissingUntil = Date.now() + RPC_MISSING_RETRY_MS;
      return { available: false };
    }
    throw new DatabaseError(error.message);
  }
  return { available: true, value: data as T };
}

function toGroupWithMembers(row: GroupRow): GroupWithMembers {
  return {
    group: toGroupEntity(row),
    members: [...row.members].sort((a, b) => a.joined_at.localeCompare(b.joined_at)),
  };
}

export const groupsRepository = {
  /** RLS already scopes `groups` to rows the caller is a member of - no extra filter needed. */
  async listForUser(supabase: SupabaseClient): Promise<GroupEntity[]> {
    const { data, error } = await supabase
      .from("groups")
      .select(GROUP_SELECT_WITH_MEMBER_COUNT)
      .order("created_at", { ascending: true });

    if (error) throw new DatabaseError(error.message);
    return ((data ?? []) as unknown as GroupRow[]).map(toGroupEntity);
  },

  /** `null` covers both "doesn't exist" and "exists but you're not a member" - RLS makes those indistinguishable, which is the point. */
  async getById(supabase: SupabaseClient, groupId: string): Promise<GroupEntity | null> {
    const { data, error } = await supabase
      .from("groups")
      .select(GROUP_SELECT_WITH_MEMBER_COUNT)
      .eq("id", groupId)
      .maybeSingle();

    if (error) throw new DatabaseError(error.message);
    return data ? toGroupEntity(data as unknown as GroupRow) : null;
  },

  async create(supabase: SupabaseClient, name: string): Promise<GroupEntity> {
    const { data, error } = await supabase.rpc("create_group", { p_name: name }).single();
    if (error) throw new DatabaseError(error.message);
    return toGroupEntity({ ...(data as GroupRow), member_count: [{ count: 1 }] });
  },

  async joinByCode(supabase: SupabaseClient, inviteCode: string): Promise<GroupEntity> {
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

  /** RPC-only, like create/joinByCode - groups has no client-facing delete policy;
   * delete_group() itself checks the caller is the group's creator. */
  async remove(supabase: SupabaseClient, groupId: string): Promise<void> {
    const { error } = await supabase.rpc("delete_group", { p_group_id: groupId });
    if (error) throw new DatabaseError(error.message);
  },

  /** RPC-only, like create/delete - groups has no client-facing update policy;
   * update_group_name() itself checks the caller is the group's creator. Re-fetches
   * afterward the same way joinByCode does - the RPC returns the bare `groups` row,
   * without the embedded member_count aggregate the rest of this module expects. */
  async updateName(supabase: SupabaseClient, groupId: string, name: string): Promise<GroupEntity> {
    const { error } = await supabase.rpc("update_group_name", { p_group_id: groupId, p_name: name });
    if (error) throw new DatabaseError(error.message);
    const group = await groupsRepository.getById(supabase, groupId);
    if (!group) throw new DatabaseError("Renamed the group but couldn't load it back.");
    return group;
  },

  /** Every group the caller belongs to (RLS-scoped), each with its member rows, in one query. */
  async listWithMembers(supabase: SupabaseClient): Promise<GroupWithMembers[]> {
    const { data, error } = await supabase
      .from("groups")
      .select(GROUP_SELECT_WITH_MEMBERS)
      .order("created_at", { ascending: true });

    if (error) throw new DatabaseError(error.message);
    return ((data ?? []) as unknown as GroupRow[]).map(toGroupWithMembers);
  },

  /**
   * Every group the caller belongs to with its first `previewLimit` members' profiles, in a single
   * call. Deliberately returns profile columns even though `profiles` belongs to another module:
   * the point is one round trip, and the function runs as the caller so RLS still decides what is
   * visible (docs/ARCHITECTURE_DESIGN.md section 2.3 is otherwise unchanged).
   */
  listWithMemberProfiles(
    supabase: SupabaseClient,
    previewLimit: number,
  ): Promise<RpcResult<GroupWithMemberProfiles[]>> {
    return callGroupRpc(supabase, "list_groups_with_members", { p_preview_limit: previewLimit });
  },

  /** One group with all members and their profiles in a single call; value is `null` when the group
   * does not exist or the caller is not a member (indistinguishable, as with `getById`). */
  getWithMemberProfiles(
    supabase: SupabaseClient,
    groupId: string,
  ): Promise<RpcResult<GroupWithMemberProfiles | null>> {
    return callGroupRpc(supabase, "get_group_with_members", { p_group_id: groupId });
  },

  /** One group with its member rows in one query; `null` as in `getById`. */
  async getWithMembers(supabase: SupabaseClient, groupId: string): Promise<GroupWithMembers | null> {
    const { data, error } = await supabase
      .from("groups")
      .select(GROUP_SELECT_WITH_MEMBERS)
      .eq("id", groupId)
      .maybeSingle();

    if (error) throw new DatabaseError(error.message);
    return data ? toGroupWithMembers(data as unknown as GroupRow) : null;
  },
};
