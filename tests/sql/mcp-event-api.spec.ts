import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { GROUP, asAnon, asUser, createDb, makeToken, mcpMigrationFiles } from "./fixtures";

// Verifies the MCP migrations (supabase/migrations/*_mcp_*.sql) on an in-memory Postgres that has
// the app's tables, row level security policies and event rate-limit trigger. The migrations are
// applied unchanged. Specs: SPEC-event-api.md (criteria numbered below).

let db: PGlite;

test.beforeAll(async () => {
  db = await createDb();
});

test.afterAll(async () => {
  await db.close();
});

/** A fresh user per test, so rate limits, token limits and event counts never leak between tests. */
async function newUser(): Promise<string> {
  const id = randomUUID();
  await db.query("insert into auth.users values ($1)", [id]);
  return id;
}

async function expectSqlError(promise: Promise<unknown>, message: RegExp) {
  await expect(promise).rejects.toThrow(message);
}

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

/** Calls mcp_create_event as the app's route does: signed-out (anon) role plus the token. */
function createEvent(
  token: string,
  fields: {
    name?: string;
    deadline?: string;
    description?: string | null;
    externalId?: string | null;
    recurring?: boolean;
    dayOfWeek?: number | null;
  } = {},
) {
  return asAnon<{ result: { action: string; event: Record<string, unknown> } }>(
    db,
    "select public.mcp_create_event($1, $2, $3::timestamptz, $4, $5, $6, $7::smallint) as result",
    [
      token,
      fields.name ?? "Passport appointment",
      fields.deadline ?? "2026-11-20T16:59:00Z",
      fields.description ?? null,
      fields.externalId ?? null,
      fields.recurring ?? false,
      fields.dayOfWeek ?? null,
    ],
  ).then((rows) => rows[0].result);
}

const eventsOf = (userId: string) =>
  db.query<{ id: string; name: string; external_id: string | null }>(
    "select id, name, external_id from public.events where user_id = $1 order by created_at, id",
    [userId],
  ).then((r) => r.rows);

test.describe("migration hygiene", () => {
  test("there is at least one MCP migration, in timestamp order", () => {
    const files = mcpMigrationFiles();
    expect(files.length).toBeGreaterThan(0);
    expect([...files].sort()).toEqual(files);
  });

  test("migrations are additive: nothing existing is dropped or its policies changed (criterion 10)", () => {
    const dir = path.join(process.cwd(), "supabase", "migrations");
    for (const file of mcpMigrationFiles()) {
      const code = fs
        .readFileSync(path.join(dir, file), "utf8")
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .toLowerCase();
      expect(code, `${file} must not drop or alter existing policies`).not.toMatch(/(drop|alter)\s+policy/);
      expect(code, `${file} must not drop tables`).not.toMatch(/drop\s+table/);
      expect(code, `${file} must not disable row level security`).not.toMatch(/disable\s+row\s+level/);
    }
  });
});

test.describe("tokens: create, store, expose", () => {
  test("create_api_token returns a cdt_ token whose hash (not the token) is stored", async () => {
    const user = await newUser();
    const { id, token, token_prefix } = await makeToken(db, user, "Claude Code laptop");

    expect(token).toMatch(/^cdt_[0-9a-f]{64}$/);
    expect(token_prefix).toBe(token.slice(0, 8));

    const [row] = (await db.query<{ hash: string; name: string; user_id: string }>(
      "select encode(token_hash, 'hex') as hash, name, user_id from public.api_tokens where id = $1",
      [id],
    )).rows;
    expect(row.hash).toBe(sha256(token));
    expect(row.name).toBe("Claude Code laptop");
    expect(row.user_id).toBe(user);

    const everything = JSON.stringify((await db.query("select * from public.api_tokens where id = $1", [id])).rows);
    expect(everything).not.toContain(token);
  });

  test("two tokens are different", async () => {
    const user = await newUser();
    const a = await makeToken(db, user);
    const b = await makeToken(db, user);
    expect(a.token).not.toBe(b.token);
  });

  test("an owner can read the safe columns of their own tokens only (criterion 7)", async () => {
    const alice = await newUser();
    const bob = await newUser();
    await makeToken(db, alice, "alice token");
    await makeToken(db, bob, "bob token");

    const rows = await asUser<{ name: string; token_prefix: string }>(
      db, alice, "select name, token_prefix, created_at, last_used_at, expires_at, revoked_at from public.api_tokens",
    );
    expect(rows.map((r) => r.name)).toEqual(["alice token"]);
    expect(rows[0].token_prefix).toMatch(/^cdt_/);
  });

  test("token_hash is not selectable by signed-in users (criterion 7)", async () => {
    const user = await newUser();
    await makeToken(db, user);
    await expectSqlError(asUser(db, user, "select token_hash from public.api_tokens"), /permission denied/i);
    await expectSqlError(asUser(db, user, "select * from public.api_tokens"), /permission denied/i);
  });

  test("tokens cannot be written directly: only through the functions", async () => {
    const user = await newUser();
    const { id } = await makeToken(db, user);
    await expectSqlError(
      asUser(db, user, "insert into public.api_tokens (user_id, name, token_hash, token_prefix) values ($1, 'x', 'abc'::bytea, 'cdt_xxxx')", [user]),
      /permission denied|row-level security/i,
    );
    await expectSqlError(asUser(db, user, "update public.api_tokens set revoked_at = null where id = $1", [id]), /permission denied|row-level security/i);
    await expectSqlError(asUser(db, user, "delete from public.api_tokens where id = $1", [id]), /permission denied|row-level security/i);
  });

  test("signed-out callers cannot see tokens or create or revoke them", async () => {
    const user = await newUser();
    const { id } = await makeToken(db, user);
    await expectSqlError(asAnon(db, "select * from public.api_tokens"), /permission denied/i);
    await expectSqlError(asAnon(db, "select * from public.create_api_token('x', null)"), /permission denied/i);
    await expectSqlError(asAnon(db, "select public.revoke_api_token($1)", [id]), /permission denied/i);
  });

  test("the internal token check is not callable by app roles", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    await expectSqlError(asUser(db, user, "select public.api_token_user($1)", [token]), /permission denied/i);
    await expectSqlError(asAnon(db, "select public.api_token_user($1)", [token]), /permission denied/i);
  });
});

test.describe("tokens: rules", () => {
  test("creating a token needs a signed-in user", async () => {
    await db.exec(`set role authenticated; set request.jwt.claims = '{}'`);
    try {
      await expectSqlError(db.query("select * from public.create_api_token('x', null)"), /Not signed in/);
    } finally {
      await db.exec("reset role; reset request.jwt.claims");
    }
  });

  test("a name of 1 to 60 characters is required", async () => {
    const user = await newUser();
    await expectSqlError(makeToken(db, user, ""), /Invalid input: name/);
    await expectSqlError(makeToken(db, user, "   "), /Invalid input: name/);
    await expectSqlError(makeToken(db, user, "x".repeat(61)), /Invalid input: name/);
    await expect(makeToken(db, user, "x".repeat(60))).resolves.toBeTruthy();
  });

  test("an expiry must be in the future", async () => {
    const user = await newUser();
    await expectSqlError(makeToken(db, user, "old", "2020-01-01T00:00:00Z"), /Invalid input: expiry/);
    await expect(makeToken(db, user, "future", "2099-01-01T00:00:00Z")).resolves.toBeTruthy();
  });

  test("at most 10 active tokens per user; revoked ones do not count", async () => {
    const user = await newUser();
    const created = [];
    for (let i = 0; i < 10; i++) created.push(await makeToken(db, user, `t${i}`));
    await expectSqlError(makeToken(db, user, "eleventh"), /Token limit reached/);

    await asUser(db, user, "select public.revoke_api_token($1)", [created[0].id]);
    await expect(makeToken(db, user, "eleventh, after a revoke")).resolves.toBeTruthy();
  });

  test("revoke works for the owner, is repeatable, and refuses other users' tokens", async () => {
    const alice = await newUser();
    const bob = await newUser();
    const { id } = await makeToken(db, alice);

    await expectSqlError(asUser(db, bob, "select public.revoke_api_token($1)", [id]), /Token not found/);
    await asUser(db, alice, "select public.revoke_api_token($1)", [id]);
    await asUser(db, alice, "select public.revoke_api_token($1)", [id]);

    const [row] = (await db.query<{ revoked_at: string | null }>("select revoked_at from public.api_tokens where id = $1", [id])).rows;
    expect(row.revoked_at).not.toBeNull();
  });
});

test.describe("token check (api_token_user)", () => {
  const owner = (token: string | null) =>
    db.query<{ owner: string }>("select public.api_token_user($1) as owner", [token]).then((r) => r.rows[0].owner);

  test("a valid token resolves to its owner", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    expect(await owner(token)).toBe(user);
  });

  test("unknown, empty, null, revoked and expired tokens all fail with the same message (criterion 3)", async () => {
    const user = await newUser();
    const revoked = await makeToken(db, user, "revoked");
    await asUser(db, user, "select public.revoke_api_token($1)", [revoked.id]);

    const expired = await makeToken(db, user, "expired", "2099-01-01T00:00:00Z");
    await db.query("update public.api_tokens set expires_at = now() - interval '1 minute' where id = $1", [expired.id]);

    const messages: string[] = [];
    for (const bad of ["cdt_" + "0".repeat(64), "", null, revoked.token, expired.token, "not a token"]) {
      try {
        await owner(bad);
        messages.push("NO ERROR");
      } catch (error) {
        messages.push((error as Error).message);
      }
    }
    expect(new Set(messages)).toEqual(new Set(["Invalid token"]));
  });

  test("last_used_at is set on use", async () => {
    const user = await newUser();
    const { id, token } = await makeToken(db, user);
    const before = (await db.query<{ last_used_at: string | null }>("select last_used_at from public.api_tokens where id = $1", [id])).rows[0];
    expect(before.last_used_at).toBeNull();

    await owner(token);
    const after = (await db.query<{ last_used_at: string | null }>("select last_used_at from public.api_tokens where id = $1", [id])).rows[0];
    expect(after.last_used_at).not.toBeNull();
  });

  test("the 61st call within a minute is refused (criterion 8)", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);

    // One transaction keeps now() fixed, so all calls land in the same minute bucket. The outcome of
    // the 61st call is recorded inside and asserted OUTSIDE: the aborted transaction is rolled back
    // when it ends, and anything thrown in there must not be able to hide a failing assertion.
    let sixtyFirst = "not attempted";
    await db.transaction(async (tx) => {
      for (let i = 1; i <= 60; i++) {
        await tx.query("select public.api_token_user($1)", [token]);
      }
      sixtyFirst = await tx.query("select public.api_token_user($1)", [token]).then(
        () => "NOT REFUSED",
        (error: Error) => error.message,
      );
    }).catch(() => undefined);
    expect(sixtyFirst).toBe("Rate limit reached");
  });

  test("failed token checks do not consume the rate limit of real tokens", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    for (let i = 0; i < 5; i++) await owner("cdt_" + "f".repeat(64)).catch(() => undefined);
    expect(await owner(token)).toBe(user);
  });
});

test.describe("mcp_create_event", () => {
  test("creates a personal event for the token's owner (criterion 1)", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);

    const result = await createEvent(token, { name: "Passport appointment", externalId: "vault:Personal/Passport.md#appointment" });
    expect(result.action).toBe("created");
    expect(result.event).toMatchObject({
      name: "Passport appointment",
      external_id: "vault:Personal/Passport.md#appointment",
      is_recurring: false,
      recurrence_day_of_week: null,
    });
    expect(new Date(result.event.deadline as string).toISOString()).toBe("2026-11-20T16:59:00.000Z");

    const [row] = (await db.query<{ user_id: string; group_id: string | null }>(
      "select user_id, group_id from public.events where id = $1", [result.event.id])).rows;
    expect(row.user_id).toBe(user);
    expect(row.group_id).toBeNull();
  });

  test("the same external_id twice updates one row (criterion 2)", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);

    const first = await createEvent(token, { name: "Dentist", externalId: "vault:dentist", deadline: "2026-12-01T16:59:00Z" });
    const second = await createEvent(token, { name: "Dentist (moved)", externalId: "vault:dentist", deadline: "2026-12-05T02:30:00Z", description: "bring forms" });

    expect(first.action).toBe("created");
    expect(second.action).toBe("updated");
    expect(second.event.id).toBe(first.event.id);

    const rows = await eventsOf(user);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Dentist (moved)");
    expect(second.event.description).toBe("bring forms");
    expect(new Date(second.event.deadline as string).toISOString()).toBe("2026-12-05T02:30:00.000Z");
  });

  test("without an external_id every call creates a new event", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    await createEvent(token, { name: "A" });
    await createEvent(token, { name: "A" });
    expect(await eventsOf(user)).toHaveLength(2);
  });

  test("the same external_id for two different users does not collide, and tokens never cross over (criterion 4)", async () => {
    const alice = await newUser();
    const bob = await newUser();
    const a = await makeToken(db, alice);
    const b = await makeToken(db, bob);

    const ea = await createEvent(a.token, { name: "Alice's", externalId: "shared-id" });
    const eb = await createEvent(b.token, { name: "Bob's", externalId: "shared-id" });
    expect(ea.action).toBe("created");
    expect(eb.action).toBe("created");
    expect(eb.event.id).not.toBe(ea.event.id);

    expect((await eventsOf(alice)).map((e) => e.name)).toEqual(["Alice's"]);
    expect((await eventsOf(bob)).map((e) => e.name)).toEqual(["Bob's"]);
  });

  test("a group event of the same user is never touched, even with a matching external_id (criterion 5)", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    await db.query("insert into public.group_members values ($1, $2) on conflict do nothing", [GROUP, user]);
    await db.query(
      "insert into public.events (user_id, name, deadline, group_id, external_id) values ($1, 'Group event', now(), $2, 'clash')",
      [user, GROUP],
    );

    await expectSqlError(createEvent(token, { name: "Personal", externalId: "clash" }), /Invalid input: external_id/);
    const [row] = (await db.query<{ name: string }>("select name from public.events where user_id = $1 and group_id is not null", [user])).rows;
    expect(row.name).toBe("Group event");
  });

  test("invalid, revoked and missing tokens create nothing (criteria 3, 4)", async () => {
    const user = await newUser();
    const good = await makeToken(db, user);
    await asUser(db, user, "select public.revoke_api_token($1)", [good.id]);

    await expectSqlError(createEvent("cdt_" + "1".repeat(64)), /Invalid token/);
    await expectSqlError(createEvent(good.token), /Invalid token/);
    expect(await eventsOf(user)).toHaveLength(0);
  });

  test("validation matches the app: names, descriptions, external ids, repeat rules (criterion 9)", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);

    await expectSqlError(createEvent(token, { name: "" }), /Invalid input: name/);
    await expectSqlError(createEvent(token, { name: "   " }), /Invalid input: name/);
    await expectSqlError(createEvent(token, { name: "n".repeat(201) }), /Invalid input: name/);
    await expectSqlError(createEvent(token, { description: "d".repeat(2001) }), /Invalid input: description/);
    await expectSqlError(createEvent(token, { externalId: "" }), /Invalid input: external_id/);
    await expectSqlError(createEvent(token, { externalId: "e".repeat(201) }), /Invalid input: external_id/);
    await expectSqlError(createEvent(token, { recurring: true, dayOfWeek: null }), /Invalid input: day of week/);
    await expectSqlError(createEvent(token, { recurring: true, dayOfWeek: 7 }), /Invalid input: day of week/);

    expect(await eventsOf(user)).toHaveLength(0);

    await expect(createEvent(token, { name: "n".repeat(200), description: "d".repeat(2000), externalId: "e".repeat(200) })).resolves.toBeTruthy();
  });

  test("a weekly event keeps its weekday; a one-off event drops any weekday", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);

    const weekly = await createEvent(token, { name: "Standup", recurring: true, dayOfWeek: 1 });
    expect(weekly.event).toMatchObject({ is_recurring: true, recurrence_day_of_week: 1 });

    const oneOff = await createEvent(token, { name: "One-off", recurring: false, dayOfWeek: 3 });
    expect(oneOff.event).toMatchObject({ is_recurring: false, recurrence_day_of_week: null });
  });

  test("the app's own creation rate limit still applies (20 per minute)", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);

    let twentyFirst = "not attempted";
    await db.transaction(async (tx) => {
      for (let i = 0; i < 20; i++) {
        await tx.query("select public.mcp_create_event($1, $2, now() + interval '1 day', null, null, false, null)", [token, `e${i}`]);
      }
      twentyFirst = await tx
        .query("select public.mcp_create_event($1, 'one too many', now() + interval '1 day', null, null, false, null)", [token])
        .then(
          () => "NOT REFUSED",
          (error: Error) => error.message,
        );
    }).catch(() => undefined);
    expect(twentyFirst).toMatch(/Too many events/);
  });

  test("signed-out callers can run the function (that is the point) but cannot read events", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    await createEvent(token, { name: "visible only through the owner" });
    // Supabase grants anon the table but row level security returns no rows; this fixture withholds the
    // grant, so the read is refused outright. Either way a signed-out caller never sees an event.
    const rows = await asAnon(db, "select * from public.events").catch((error: Error) => {
      expect(error.message).toMatch(/permission denied/i);
      return [];
    });
    expect(rows).toHaveLength(0);
  });

  test("normal app access to events is unchanged: users see only their own (criterion 10)", async () => {
    const alice = await newUser();
    const bob = await newUser();
    const a = await makeToken(db, alice);
    const b = await makeToken(db, bob);
    await createEvent(a.token, { name: "A's event", externalId: "x" });
    await createEvent(b.token, { name: "B's event", externalId: "y" });

    expect((await asUser<{ name: string }>(db, alice, "select name from public.events")).map((e) => e.name)).toEqual(["A's event"]);
    expect((await asUser<{ name: string }>(db, bob, "select name from public.events")).map((e) => e.name)).toEqual(["B's event"]);
  });
});
