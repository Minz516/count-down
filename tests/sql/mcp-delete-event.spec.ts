import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { GROUP, asAnon, createDb, makeToken } from "./fixtures";

// Slice D: mcp_delete_event (supabase/migrations/20261007000002_mcp_delete_event.sql), applied unchanged.

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

async function seed(user: string, name = "Dentist", externalId: string | null = null, groupId: string | null = null) {
  const { rows } = await db.query<{ id: string }>(
    "insert into public.events (user_id, name, deadline, external_id, group_id) values ($1, $2, '2026-11-20T16:59:00Z', $3, $4) returning id",
    [user, name, externalId, groupId],
  );
  return rows[0].id;
}

const exists = (id: string) => db.query("select 1 from public.events where id = $1", [id]).then((r) => r.rows.length === 1);

function del(token: string, target: { id?: string | null; externalId?: string | null }, confirm: boolean | null = true) {
  return asAnon<{ result: { action: string; event: Record<string, unknown> } }>(
    db,
    "select public.mcp_delete_event($1, $2::uuid, $3, $4::boolean) as result",
    [token, target.id ?? null, target.externalId ?? null, confirm],
  ).then((rows) => rows[0].result);
}

test.describe("mcp_delete_event: confirmation", () => {
  test("without confirm: true nothing is deleted", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    const id = await seed(user);

    await expect(del(token, { id }, false)).rejects.toThrow(/Confirmation required/);
    await expect(del(token, { id }, null)).rejects.toThrow(/Confirmation required/);
    expect(await exists(id)).toBe(true);
  });

  test("the default for confirm is false", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    const id = await seed(user);
    await expect(asAnon(db, "select public.mcp_delete_event($1, $2::uuid)", [token, id])).rejects.toThrow(/Confirmation required/);
    expect(await exists(id)).toBe(true);
  });
});

test.describe("mcp_delete_event: deleting", () => {
  test("by id, and the answer says what was deleted", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    const id = await seed(user, "Dentist", "vault:dentist");

    const result = await del(token, { id });
    expect(result.action).toBe("deleted");
    expect(result.event).toMatchObject({ id, name: "Dentist", external_id: "vault:dentist" });
    expect(await exists(id)).toBe(false);
  });

  test("by external_id removes only that event", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    const keep = await seed(user, "Keep", "keep");
    const gone = await seed(user, "Gone", "gone");

    await del(token, { externalId: "gone" });
    expect(await exists(gone)).toBe(false);
    expect(await exists(keep)).toBe(true);
  });

  test("deleting twice is Event not found the second time", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    const id = await seed(user);
    await del(token, { id });
    await expect(del(token, { id })).rejects.toThrow(/Event not found/);
  });

  test("exactly one target is required", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    const id = await seed(user, "x", "x");
    await expect(del(token, {})).rejects.toThrow(/Invalid input: target/);
    await expect(del(token, { id, externalId: "x" })).rejects.toThrow(/Invalid input: target/);
    expect(await exists(id)).toBe(true);
  });
});

test.describe("mcp_delete_event: boundaries", () => {
  test("another user's event looks like a missing one and survives", async () => {
    const alice = await newUser();
    const bob = await newUser();
    const b = await makeToken(db, bob);
    const id = await seed(alice, "Alice's", "shared");

    await expect(del(b.token, { id })).rejects.toThrow(/Event not found/);
    await expect(del(b.token, { externalId: "shared" })).rejects.toThrow(/Event not found/);
    expect(await exists(id)).toBe(true);
  });

  test("a group event of the same user survives", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    await db.query("insert into public.group_members values ($1, $2) on conflict do nothing", [GROUP, user]);
    const id = await seed(user, "Group event", "g1", GROUP);

    await expect(del(token, { id })).rejects.toThrow(/Event not found/);
    await expect(del(token, { externalId: "g1" })).rejects.toThrow(/Event not found/);
    expect(await exists(id)).toBe(true);
  });

  test("a bad or revoked token is Invalid token and deletes nothing", async () => {
    const user = await newUser();
    const { id: tokenId, token } = await makeToken(db, user);
    const id = await seed(user);

    await expect(del("cdt_" + "0".repeat(64), { id })).rejects.toThrow(/Invalid token/);
    await db.query("update public.api_tokens set revoked_at = now() where id = $1", [tokenId]);
    await expect(del(token, { id })).rejects.toThrow(/Invalid token/);
    expect(await exists(id)).toBe(true);
  });
});
