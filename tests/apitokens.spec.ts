import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { apiTokensInterface } from "@/modules/apitokens/apitokens.interface";
import { AppError, NotAuthenticatedError, ValidationError } from "@/modules/shared/errors";

// T7: the module behind the Settings "Claude Code access" section. A fake client records the query that is
// built (which columns, which filter, which order) and the rpc calls, and replies as the database would.

const USER = "11111111-1111-1111-1111-111111111111";
const NOW = new Date("2026-10-06T10:00:00Z");

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "t1",
  user_id: USER,
  name: "Claude Code laptop",
  token_prefix: "cdt_ab12",
  created_at: "2026-10-01T00:00:00+00:00",
  last_used_at: null,
  expires_at: null,
  revoked_at: null,
  ...overrides,
});

interface Recorded {
  table?: string;
  select?: string;
  eq?: [string, unknown];
  order?: [string, unknown];
  rpc: { fn: string; args: Record<string, unknown> }[];
}

type Reply = { data: unknown; error: { message: string } | null };

function fakeClient({ rows = [] as unknown[], rpcReply = { data: null, error: null } as Reply, listError = null as { message: string } | null } = {}) {
  const recorded: Recorded = { rpc: [] };
  const client = {
    from(table: string) {
      recorded.table = table;
      const chain = {
        select(columns: string) {
          recorded.select = columns;
          return chain;
        },
        eq(column: string, value: unknown) {
          recorded.eq = [column, value];
          return chain;
        },
        order(column: string, options: unknown) {
          recorded.order = [column, options];
          return Promise.resolve({ data: listError ? null : rows, error: listError });
        },
      };
      return chain;
    },
    rpc(fn: string, args: Record<string, unknown>) {
      recorded.rpc.push({ fn, args });
      const result = Promise.resolve(rpcReply) as Promise<Reply> & { single: () => Promise<Reply> };
      result.single = () => Promise.resolve(rpcReply);
      return result;
    },
  } as unknown as SupabaseClient;
  return { client, recorded };
}

const ok = (data: unknown): Reply => ({ data, error: null });
const fail = (message: string): Reply => ({ data: null, error: { message } });

test.describe("listTokens", () => {
  test("selects only the safe columns, filters by the user, newest first", async () => {
    const { client, recorded } = fakeClient({ rows: [row()] });
    await apiTokensInterface.listTokens(client, USER, NOW);

    expect(recorded.table).toBe("api_tokens");
    expect(recorded.select).not.toContain("*");
    expect(recorded.select).not.toContain("token_hash");
    expect(recorded.select?.split(",").map((c) => c.trim()).sort()).toEqual(
      ["created_at", "expires_at", "id", "last_used_at", "name", "revoked_at", "token_prefix", "user_id"],
    );
    expect(recorded.eq).toEqual(["user_id", USER]);
    expect(recorded.order).toEqual(["created_at", { ascending: false }]);
  });

  test("maps rows to display data and works out the status", async () => {
    const { client } = fakeClient({
      rows: [
        row({ id: "active", last_used_at: "2026-10-05T08:00:00+00:00" }),
        row({ id: "future-expiry", expires_at: "2099-01-01T00:00:00+00:00" }),
        row({ id: "expired", expires_at: "2026-10-01T00:00:00+00:00" }),
        row({ id: "revoked", revoked_at: "2026-10-02T00:00:00+00:00" }),
        row({ id: "revoked-and-expired", revoked_at: "2026-10-02T00:00:00+00:00", expires_at: "2026-10-01T00:00:00+00:00" }),
      ],
    });
    const tokens = await apiTokensInterface.listTokens(client, USER, NOW);

    expect(tokens.map((t) => [t.id, t.status])).toEqual([
      ["active", "active"],
      ["future-expiry", "active"],
      ["expired", "expired"],
      ["revoked", "revoked"],
      ["revoked-and-expired", "revoked"], // revoked wins: that is the stronger fact
    ]);
    expect(tokens[0]).toMatchObject({
      name: "Claude Code laptop",
      prefix: "cdt_ab12",
      createdAt: "2026-10-01T00:00:00+00:00",
      lastUsedAt: "2026-10-05T08:00:00+00:00",
      expiresAt: null,
      revokedAt: null,
    });
  });

  test("a listed token never carries a token value or a hash, even if the row had one", async () => {
    const { client } = fakeClient({ rows: [row({ token: "cdt_leak", token_hash: "\\xdeadbeef" })] });
    const [token] = await apiTokensInterface.listTokens(client, USER, NOW);

    expect(JSON.stringify(token)).not.toContain("cdt_leak");
    expect(JSON.stringify(token)).not.toContain("deadbeef");
    expect(Object.keys(token)).not.toContain("token");
  });

  test("a database error becomes a generic message", async () => {
    const { client } = fakeClient({ listError: { message: "relation api_tokens does not exist" } });
    const error = (await apiTokensInterface.listTokens(client, USER, NOW).catch((e: unknown) => e)) as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.message).not.toContain("relation");
  });
});

test.describe("createToken", () => {
  const created = (overrides: Record<string, unknown> = {}) =>
    ok({ id: "t9", token: "cdt_" + "c".repeat(64), token_prefix: "cdt_cccc", created_at: "2026-10-06T10:00:00+00:00", ...overrides });

  test("sends the trimmed name and no expiry by default, and returns the token once", async () => {
    const { client, recorded } = fakeClient({ rpcReply: created() });
    const result = await apiTokensInterface.createToken(client, { name: "  Claude Code laptop  " }, NOW);

    expect(recorded.rpc).toEqual([{ fn: "create_api_token", args: { p_name: "Claude Code laptop", p_expires_at: null } }]);
    expect(result).toEqual({
      id: "t9",
      token: "cdt_" + "c".repeat(64),
      prefix: "cdt_cccc",
      createdAt: "2026-10-06T10:00:00+00:00",
    });
  });

  test("forwards a future expiry", async () => {
    const { client, recorded } = fakeClient({ rpcReply: created() });
    await apiTokensInterface.createToken(client, { name: "x", expiresAt: "2027-01-01T00:00:00Z" }, NOW);
    expect(recorded.rpc[0].args.p_expires_at).toBe("2027-01-01T00:00:00Z");
  });

  test("a blank or over-long name is refused before any database call", async () => {
    const { client, recorded } = fakeClient({ rpcReply: created() });
    for (const name of ["", "   ", "x".repeat(61)]) {
      await expect(apiTokensInterface.createToken(client, { name }, NOW), JSON.stringify(name)).rejects.toBeInstanceOf(ValidationError);
    }
    expect(recorded.rpc).toHaveLength(0);
    await expect(apiTokensInterface.createToken(client, { name: "x".repeat(60) }, NOW)).resolves.toBeTruthy();
  });

  test("an expiry that is not in the future is refused before any database call", async () => {
    const { client, recorded } = fakeClient({ rpcReply: created() });
    await expect(apiTokensInterface.createToken(client, { name: "x", expiresAt: "2026-10-06T09:00:00Z" }, NOW)).rejects.toThrow(/expiry/i);
    await expect(apiTokensInterface.createToken(client, { name: "x", expiresAt: "not a date" }, NOW)).rejects.toThrow(/expiry/i);
    expect(recorded.rpc).toHaveLength(0);
  });

  test("the limit of 10 active tokens becomes a readable instruction", async () => {
    const { client } = fakeClient({ rpcReply: fail("Token limit reached") });
    const error = (await apiTokensInterface.createToken(client, { name: "x" }, NOW).catch((e: unknown) => e)) as AppError;
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toMatch(/10 active tokens.*revoke/i);
  });

  test("not being signed in is reported as such", async () => {
    const { client } = fakeClient({ rpcReply: fail("Not signed in") });
    await expect(apiTokensInterface.createToken(client, { name: "x" }, NOW)).rejects.toBeInstanceOf(NotAuthenticatedError);
  });

  test("an unknown database error is generic and never contains the original text", async () => {
    const { client } = fakeClient({ rpcReply: fail("permission denied for function create_api_token") });
    const error = (await apiTokensInterface.createToken(client, { name: "x" }, NOW).catch((e: unknown) => e)) as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.message).not.toContain("permission denied");
  });
});

test.describe("revokeToken", () => {
  test("calls the revoke function with the token id", async () => {
    const { client, recorded } = fakeClient({ rpcReply: ok(null) });
    await apiTokensInterface.revokeToken(client, "t1");
    expect(recorded.rpc).toEqual([{ fn: "revoke_api_token", args: { p_token_id: "t1" } }]);
  });

  test("a token that is not the caller's is a readable error", async () => {
    const { client } = fakeClient({ rpcReply: fail("Token not found") });
    const error = (await apiTokensInterface.revokeToken(client, "t1").catch((e: unknown) => e)) as AppError;
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toMatch(/not found/i);
  });

  test("a blank id is refused before any database call", async () => {
    const { client, recorded } = fakeClient({ rpcReply: ok(null) });
    await expect(apiTokensInterface.revokeToken(client, "")).rejects.toBeInstanceOf(ValidationError);
    expect(recorded.rpc).toHaveLength(0);
  });
});
