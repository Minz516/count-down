import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { resetGroupRpcAvailability } from "@/modules/groups/groups.repository";
import { groupsService } from "@/modules/groups/groups.service";

// Unit tests for the two read paths in groups.service.ts: the single-call SQL functions
// (supabase/migrations/20261002000000_group_with_members_rpc.sql) and the two-call fallback used
// while those functions are not installed. A tiny fake client stands in for Supabase, so no
// database is needed.

// The "functions are missing" verdict is module state; clear it so test order never matters.
test.beforeEach(() => resetGroupRpcAvailability());

const GROUP = {
  id: "g1",
  name: "Class",
  invite_code: "AAAA1111",
  created_by: "u1",
  created_at: "2026-01-01T00:00:00+00:00",
  member_count: 5,
};

const MEMBERS = [
  { user_id: "u1", joined_at: "2026-02-01T00:00:00+00:00", username: "alice", avatar_url: null },
  { user_id: "u2", joined_at: "2026-02-02T00:00:00+00:00", username: "bob", avatar_url: "https://x/bob.png" },
  { user_id: "u3", joined_at: "2026-02-03T00:00:00+00:00", username: null, avatar_url: null },
  { user_id: "u4", joined_at: "2026-02-04T00:00:00+00:00", username: "dave", avatar_url: "https://x/dave.png" },
  { user_id: "u5", joined_at: "2026-02-05T00:00:00+00:00", username: "erin", avatar_url: null },
];

type RpcReply = { data: unknown; error: { code: string; message: string } | null };

/** Records every call so a test can assert how many round trips happened. */
function fakeClient(rpcReply: (fn: string) => RpcReply) {
  const calls: string[] = [];
  const client = {
    rpc(fn: string) {
      calls.push(`rpc:${fn}`);
      return Promise.resolve(rpcReply(fn));
    },
    from(table: string) {
      calls.push(`from:${table}`);
      // The fallback path chains .select().order() / .select().eq().maybeSingle() / .in(); every
      // chain resolves to the same shape the real client would return for these fixtures.
      const rows =
        table === "groups"
          ? [{ ...GROUP, member_count: [{ count: 5 }], members: MEMBERS.map((m) => ({ user_id: m.user_id, joined_at: m.joined_at })) }]
          : MEMBERS.filter((m) => m.username !== null).map((m) => ({ id: m.user_id, username: m.username, avatar_url: m.avatar_url }));
      const result = { data: rows, error: null };
      const chain: Record<string, unknown> = {
        select: () => chain,
        order: () => Promise.resolve(result),
        eq: () => chain,
        in: () => Promise.resolve(result),
        maybeSingle: () => Promise.resolve({ data: rows[0], error: null }),
      };
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const missing: RpcReply = {
  data: null,
  error: { code: "PGRST202", message: "Could not find the function public.list_groups_with_members in the schema cache" },
};

test.describe("with the SQL functions installed", () => {
  test("list makes one call and builds previews from the first four members", async () => {
    const { client, calls } = fakeClient(() => ({ data: [{ group: GROUP, members: MEMBERS.slice(0, 4) }], error: null }));
    const groups = await groupsService.listGroupsForUser(client);

    expect(calls).toEqual(["rpc:list_groups_with_members"]);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("Class");
    expect(groups[0].member_count).toBe(5);
    expect(groups[0].preview_avatars).toEqual([null, "https://x/bob.png", null, "https://x/dave.png"]);
  });

  test("detail makes one call and returns every member with profile data", async () => {
    const { client, calls } = fakeClient(() => ({ data: { group: GROUP, members: MEMBERS }, error: null }));
    const { group, members } = await groupsService.getGroupWithMembers(client, "g1");

    expect(calls).toEqual(["rpc:get_group_with_members"]);
    expect(group?.id).toBe("g1");
    expect(members.map((m) => m.user_id)).toEqual(["u1", "u2", "u3", "u4", "u5"]);
    expect(members[2].username).toBeNull();
    expect(members[1]).toEqual({
      user_id: "u2",
      username: "bob",
      avatar_url: "https://x/bob.png",
      joined_at: "2026-02-02T00:00:00+00:00",
    });
  });

  test("a group the caller cannot see comes back as no group and no members", async () => {
    const { client } = fakeClient(() => ({ data: null, error: null }));
    expect(await groupsService.getGroupWithMembers(client, "someone-elses")).toEqual({ group: null, members: [] });
  });

  test("a real database error is thrown, not swallowed by the fallback", async () => {
    const { client } = fakeClient(() => ({ data: null, error: { code: "42501", message: "permission denied" } }));
    await expect(groupsService.listGroupsForUser(client)).rejects.toThrow("permission denied");
  });
});

test.describe("while the SQL functions are missing", () => {
  test("list falls back to the groups query plus one profiles lookup", async () => {
    const { client, calls } = fakeClient(() => missing);
    const groups = await groupsService.listGroupsForUser(client);

    expect(calls).toEqual(["rpc:list_groups_with_members", "from:groups", "from:profiles"]);
    expect(groups[0].preview_avatars).toEqual([null, "https://x/bob.png", null, "https://x/dave.png"]);
  });

  test("the missing verdict is remembered, so the next call skips the failing rpc", async () => {
    const { client, calls } = fakeClient(() => missing);
    await groupsService.listGroupsForUser(client);
    calls.length = 0;
    await groupsService.listGroupsForUser(client);

    expect(calls).toEqual(["from:groups", "from:profiles"]);
  });
});
