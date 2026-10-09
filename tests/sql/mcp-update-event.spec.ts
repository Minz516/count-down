import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { GROUP, asAnon, createDb, makeToken } from "./fixtures";

// Slice B: mcp_update_event (supabase/migrations/20261007000000_mcp_update_event.sql), applied unchanged.

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

async function seed(user: string, fields: { name?: string; externalId?: string | null; description?: string | null; recurring?: boolean; dow?: number | null } = {}) {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.events (user_id, name, deadline, description, external_id, is_recurring, recurrence_day_of_week)
     values ($1, $2, '2026-11-20T16:59:00Z', $3, $4, $5, $6) returning id`,
    [user, fields.name ?? "Dentist", fields.description ?? "bring forms", fields.externalId ?? null, fields.recurring ?? false, fields.dow ?? null],
  );
  return rows[0].id;
}

type Result = { action: string; event: Record<string, unknown> };

function update(token: string, target: { id?: string | null; externalId?: string | null }, patch: unknown) {
  return asAnon<{ result: Result }>(
    db,
    "select public.mcp_update_event($1, $2::uuid, $3, $4::jsonb) as result",
    [token, target.id ?? null, target.externalId ?? null, JSON.stringify(patch)],
  ).then((rows) => rows[0].result);
}

const rowOf = (id: string) =>
  db.query<Record<string, unknown>>("select * from public.events where id = $1", [id]).then((r) => r.rows[0]);

test.describe("mcp_update_event: targeting", () => {
  test("by id, changing only the fields in the patch", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    const id = await seed(user);

    const result = await update(token, { id }, { name: "Dentist (moved)" });
    expect(result.action).toBe("updated");
    expect(result.event).toMatchObject({ id, name: "Dentist (moved)", description: "bring forms" });
    expect(new Date(result.event.deadline as string).toISOString()).toBe("2026-11-20T16:59:00.000Z");
  });

  test("by external_id", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    const id = await seed(user, { externalId: "vault:dentist" });

    const result = await update(token, { externalId: "vault:dentist" }, { deadline: "2026-12-05T02:30:00Z" });
    expect(result.event.id).toBe(id);
    expect(new Date(result.event.deadline as string).toISOString()).toBe("2026-12-05T02:30:00.000Z");
  });

  test("exactly one target is required", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    const id = await seed(user, { externalId: "x" });

    await expect(update(token, {}, { name: "a" })).rejects.toThrow(/Invalid input: target/);
    await expect(update(token, { id, externalId: "x" }, { name: "a" })).rejects.toThrow(/Invalid input: target/);
  });

  test("an unknown id or external_id is Event not found", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    await expect(update(token, { id: randomUUID() }, { name: "a" })).rejects.toThrow(/Event not found/);
    await expect(update(token, { externalId: "nope" }, { name: "a" })).rejects.toThrow(/Event not found/);
  });
});

test.describe("mcp_update_event: boundaries", () => {
  test("another user's event looks exactly like a missing one and is not changed", async () => {
    const alice = await newUser();
    const bob = await newUser();
    const b = await makeToken(db, bob);
    const id = await seed(alice, { name: "Alice's", externalId: "shared" });

    await expect(update(b.token, { id }, { name: "hacked" })).rejects.toThrow(/Event not found/);
    await expect(update(b.token, { externalId: "shared" }, { name: "hacked" })).rejects.toThrow(/Event not found/);
    expect((await rowOf(id)).name).toBe("Alice's");
  });

  test("a group event of the same user is never touched", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    await db.query("insert into public.group_members values ($1, $2) on conflict do nothing", [GROUP, user]);
    const { rows } = await db.query<{ id: string }>(
      "insert into public.events (user_id, name, deadline, group_id, external_id) values ($1, 'Group event', now(), $2, 'g1') returning id",
      [user, GROUP],
    );

    await expect(update(token, { id: rows[0].id }, { name: "x" })).rejects.toThrow(/Event not found/);
    await expect(update(token, { externalId: "g1" }, { name: "x" })).rejects.toThrow(/Event not found/);
    expect((await rowOf(rows[0].id)).name).toBe("Group event");
  });

  test("a bad or revoked token is Invalid token, and nothing changes", async () => {
    const user = await newUser();
    const { id: tokenId, token } = await makeToken(db, user);
    const id = await seed(user);

    await expect(update("cdt_" + "0".repeat(64), { id }, { name: "x" })).rejects.toThrow(/^Invalid token$|Invalid token/);
    await db.query("update public.api_tokens set revoked_at = now() where id = $1", [tokenId]);
    await expect(update(token, { id }, { name: "x" })).rejects.toThrow(/Invalid token/);
    expect((await rowOf(id)).name).toBe("Dentist");
  });
});

test.describe("mcp_update_event: patch rules", () => {
  test("description null clears it; an absent key leaves it alone", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    const id = await seed(user);

    await update(token, { id }, { name: "Renamed" });
    expect((await rowOf(id)).description).toBe("bring forms");
    await update(token, { id }, { description: null });
    expect((await rowOf(id)).description).toBeNull();
  });

  test("empty, non-object and unknown-key patches are refused", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    const id = await seed(user);

    await expect(update(token, { id }, {})).rejects.toThrow(/Invalid input: patch/);
    await expect(update(token, { id }, [1])).rejects.toThrow(/Invalid input: patch/);
    await expect(update(token, { id }, { user_id: randomUUID() })).rejects.toThrow(/Invalid input: user_id/);
    await expect(update(token, { id }, { group_id: GROUP })).rejects.toThrow(/Invalid input: group_id/);
    await expect(update(token, { id }, { external_id: "new" })).rejects.toThrow(/Invalid input: external_id/);
  });

  test("field limits and types match the app", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    const id = await seed(user);

    await expect(update(token, { id }, { name: "   " })).rejects.toThrow(/Invalid input: name/);
    await expect(update(token, { id }, { name: "a".repeat(201) })).rejects.toThrow(/Invalid input: name/);
    await expect(update(token, { id }, { name: 5 })).rejects.toThrow(/Invalid input: name/);
    await expect(update(token, { id }, { description: "a".repeat(2001) })).rejects.toThrow(/Invalid input: description/);
    await expect(update(token, { id }, { deadline: "not a date" })).rejects.toThrow(/Invalid input: deadline/);
    await expect(update(token, { id }, { deadline: null })).rejects.toThrow(/Invalid input: deadline/);
    await expect(update(token, { id }, { is_recurring: "yes" })).rejects.toThrow(/Invalid input: is_recurring/);
    await expect(update(token, { id }, { is_recurring: true, recurrence_day_of_week: 9 })).rejects.toThrow(/Invalid input: day of week/);
    expect((await rowOf(id)).name).toBe("Dentist");
  });

  test("becoming weekly needs a weekday; becoming one-off drops it", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    const id = await seed(user);

    await expect(update(token, { id }, { is_recurring: true })).rejects.toThrow(/Invalid input: day of week/);
    const weekly = await update(token, { id }, { is_recurring: true, recurrence_day_of_week: 3 });
    expect(weekly.event).toMatchObject({ is_recurring: true, recurrence_day_of_week: 3 });

    const oneOff = await update(token, { id }, { is_recurring: false });
    expect(oneOff.event).toMatchObject({ is_recurring: false, recurrence_day_of_week: null });
  });

  test("a failed patch changes nothing, even when an earlier key was valid", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    const id = await seed(user);

    await expect(update(token, { id }, { name: "Good", deadline: "garbage" })).rejects.toThrow(/Invalid input: deadline/);
    expect((await rowOf(id)).name).toBe("Dentist");
  });
});

test.describe("mcp_update_event: exposure", () => {
  test("the result never contains the owner's user id or the token hash", async () => {
    const user = await newUser();
    const { token } = await makeToken(db, user);
    const id = await seed(user);
    const text = JSON.stringify(await update(token, { id }, { name: "x" }));
    expect(text).not.toContain(user);
    expect(text).not.toContain("token_hash");
  });

  test("anon has no direct access to the events table, only the token-checked function", async () => {
    const user = await newUser();
    const id = await seed(user);
    await expect(asAnon(db, "select id from public.events where id = $1", [id])).rejects.toThrow(/permission denied/);
  });
});
