import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { GROUP, asAnon, createDb, makeToken } from "./fixtures";

// Slice C: mcp_list_events (supabase/migrations/20261007000001_mcp_list_events.sql), applied unchanged.

let db: PGlite;

test.beforeAll(async () => {
  db = await createDb();
});

test.afterAll(async () => {
  await db.close();
});

async function newUser(): Promise<string> {
  const id = randomUUID();
  await db.query("insert into auth.users values ($1)", [id]);
  return id;
}

/** Seeds directly (not through the per-minute creation limit) with a deadline relative to now. */
async function seed(user: string, name: string, daysFromNow: number, extra: { description?: string; groupId?: string; externalId?: string } = {}) {
  await db.query(
    `insert into public.events (user_id, name, deadline, description, group_id, external_id, created_at)
     values ($1, $2, now() + ($3 || ' days')::interval, $4, $5, $6, now() - interval '1 hour')`,
    [user, name, String(daysFromNow), extra.description ?? null, extra.groupId ?? null, extra.externalId ?? null],
  );
}

type Listing = { events: { id: string; name: string; external_id: string | null; deadline: string }[]; total: number };

function list(token: string, o: { from?: string | null; to?: string | null; query?: string | null; limit?: number | null } = {}) {
  return asAnon<{ result: Listing }>(
    db,
    "select public.mcp_list_events($1, $2::timestamptz, $3::timestamptz, $4, $5::integer) as result",
    [token, o.from ?? null, o.to ?? null, o.query ?? null, o.limit ?? null],
  ).then((rows) => rows[0].result);
}

const names = (l: Listing) => l.events.map((e) => e.name);

test.describe("mcp_list_events: defaults", () => {
  test("upcoming only, soonest first, with the external id", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    await seed(user, "later", 10);
    await seed(user, "past", -3);
    await seed(user, "soon", 1, { externalId: "vault:soon" });

    const result = await list(token);
    expect(names(result)).toEqual(["soon", "later"]);
    expect(result.events[0].external_id).toBe("vault:soon");
    expect(result.total).toBe(2);
  });

  test("an empty account returns an empty list, not an error", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    expect(await list(token)).toEqual({ events: [], total: 0 });
  });

  test("the default limit is 50 and total still counts everything", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    await db.query(
      `insert into public.events (user_id, name, deadline, created_at) select $1, 'e' || g, now() + (g || ' days')::interval, now() - interval '1 hour' from generate_series(1, 60) g`,
      [user],
    );
    const result = await list(token);
    expect(result.events).toHaveLength(50);
    expect(result.total).toBe(60);
    expect(names(result)[0]).toBe("e1");
  });

  test("a limit above 200 is capped at 200; a limit below 1 is refused", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    await db.query(
      `insert into public.events (user_id, name, deadline, created_at) select $1, 'e' || g, now() + (g || ' hours')::interval, now() - interval '1 hour' from generate_series(1, 230) g`,
      [user],
    );
    expect((await list(token, { limit: 100000 })).events).toHaveLength(200);
    expect((await list(token, { limit: 3 })).events).toHaveLength(3);
    await expect(list(token, { limit: 0 })).rejects.toThrow(/Invalid input: limit/);
    await expect(list(token, { limit: -5 })).rejects.toThrow(/Invalid input: limit/);
  });
});

test.describe("mcp_list_events: filters", () => {
  test("a date range, including the past when from is given", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    await seed(user, "past", -5);
    await seed(user, "near", 2);
    await seed(user, "far", 30);

    const past = await list(token, { from: new Date(Date.now() - 10 * 86400e3).toISOString(), to: new Date(Date.now() + 5 * 86400e3).toISOString() });
    expect(names(past)).toEqual(["past", "near"]);
    await expect(list(token, { from: "2026-12-01T00:00:00Z", to: "2026-11-01T00:00:00Z" })).rejects.toThrow(/Invalid input: range/);
  });

  test("text query matches name or description, ignoring case", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    await seed(user, "Passport appointment", 3);
    await seed(user, "Dentist", 4, { description: "renew PASSPORT photo" });
    await seed(user, "Gym", 5);

    expect(names(await list(token, { query: "passport" }))).toEqual(["Passport appointment", "Dentist"]);
    expect((await list(token, { query: "   " })).events).toHaveLength(3);
  });

  test("wildcard characters in the query are matched literally", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    await seed(user, "100% done", 1);
    await seed(user, "a_b", 2);
    await seed(user, "axb", 3);

    expect(names(await list(token, { query: "%" }))).toEqual(["100% done"]);
    expect(names(await list(token, { query: "a_b" }))).toEqual(["a_b"]);
    await expect(list(token, { query: "x".repeat(101) })).rejects.toThrow(/Invalid input: query/);
  });
});

test.describe("mcp_list_events: boundaries", () => {
  test("never returns another user's events or group events", async () => {
    const alice = await newUser();
    const bob = await newUser();
    const a = await makeToken(db, alice);
    await db.query("insert into public.group_members values ($1, $2) on conflict do nothing", [GROUP, alice]);
    await seed(alice, "mine", 1);
    await seed(alice, "group one", 2, { groupId: GROUP });
    await seed(bob, "bob's", 1);

    const result = await list(a.token);
    expect(names(result)).toEqual(["mine"]);
    expect(result.total).toBe(1);
  });

  test("a bad or revoked token is Invalid token", async () => {
    const user = await newUser();
    const { id, token } = await makeToken(db, user);
    await seed(user, "mine", 1);

    await expect(list("cdt_" + "0".repeat(64))).rejects.toThrow(/Invalid token/);
    await db.query("update public.api_tokens set revoked_at = now() where id = $1", [id]);
    await expect(list(token)).rejects.toThrow(/Invalid token/);
  });

  test("the result never contains user ids or the token hash", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    await seed(user, "mine", 1);
    const text = JSON.stringify(await list(token));
    expect(text).not.toContain(user);
    expect(text).not.toContain("token_hash");
  });
});
