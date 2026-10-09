import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { createMcpRouteHandler } from "@/lib/mcp/server";
import { mcpEventsInterface } from "@/modules/mcpevents/mcpevents.interface";

// Slice B: the update_event tool end to end in process, with a fake Supabase client that records rpc calls.

const TOKEN = "cdt_" + "c".repeat(64);

interface RpcCall {
  fn: string;
  args: Record<string, unknown>;
}
type Reply = { data: unknown; error: { message: string } | null };

const eventRow = (overrides: Record<string, unknown> = {}) => ({
  id: "e1",
  external_id: "vault:dentist",
  name: "Dentist",
  deadline: "2026-12-05T16:59:00+00:00",
  description: null,
  is_recurring: false,
  recurrence_day_of_week: null,
  created_at: "2026-10-05T10:00:00+00:00",
  ...overrides,
});
const updated = (overrides: Record<string, unknown> = {}): Reply => ({ data: { action: "updated", event: eventRow(overrides) }, error: null });

function setup(reply: Reply = updated()) {
  const calls: RpcCall[] = [];
  const client = {
    rpc(fn: string, args: Record<string, unknown>) {
      calls.push({ fn, args });
      return Promise.resolve(reply);
    },
  } as unknown as SupabaseClient;
  const handle = createMcpRouteHandler({ createClient: () => client, events: mcpEventsInterface });
  return { handle, calls };
}

async function callTool(handle: (r: Request) => Promise<Response>, args: Record<string, unknown>) {
  const response = await handle(
    new Request("http://localhost:3000/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "update_event", arguments: args } }),
    }),
  );
  const text = await response.text();
  const data = text.split("\n").find((line) => line.startsWith("data:"));
  return JSON.parse(data ? data.slice(5).trim() : text).result as { isError?: boolean; content: { text: string }[] };
}

test.describe("update_event: what is sent", () => {
  test("by external_id, only the given fields go into the patch", async () => {
    const { handle, calls } = setup();
    const result = await callTool(handle, { external_id: "vault:dentist", name: "Dentist (moved)" });

    expect(result.isError).toBeFalsy();
    expect(calls).toEqual([
      { fn: "mcp_update_event", args: { p_token: TOKEN, p_id: null, p_external_id: "vault:dentist", p_patch: { name: "Dentist (moved)" } } },
    ]);
    expect(result.content[0].text).toContain("Updated");
  });

  test("by id; a new date is 23:59 Ho Chi Minh and the answer shows both clocks", async () => {
    const { handle, calls } = setup();
    const result = await callTool(handle, { id: "5b0d3f6e-1f0b-4f6e-8a52-0f7f2f7a9a11", date: "2026-12-05" });

    expect(calls[0].args).toMatchObject({ p_id: "5b0d3f6e-1f0b-4f6e-8a52-0f7f2f7a9a11", p_external_id: null, p_patch: { deadline: "2026-12-05T16:59:00.000Z" } });
    expect(result.content[0].text).toContain("2026-12-05 23:59");
    expect(result.content[0].text).toContain("Asia/Ho_Chi_Minh");
  });

  test("date, time and zone combine into one UTC instant", async () => {
    const { handle, calls } = setup();
    await callTool(handle, { external_id: "x", date: "2026-12-01", time: "09:30", timezone: "America/New_York" });
    expect(calls[0].args).toMatchObject({ p_patch: { deadline: "2026-12-01T14:30:00.000Z" } });
  });

  test("description null clears it, blank clears it, text sets it", async () => {
    const { handle, calls } = setup();
    await callTool(handle, { external_id: "x", description: null });
    await callTool(handle, { external_id: "x", description: "   " });
    await callTool(handle, { external_id: "x", description: " bring forms " });
    expect(calls.map((c) => c.args.p_patch)).toEqual([{ description: null }, { description: null }, { description: "bring forms" }]);
  });

  test("making an event weekly sends the flag, the weekday and the next occurrence", async () => {
    const { handle, calls } = setup(updated({ is_recurring: true, recurrence_day_of_week: 1 }));
    const result = await callTool(handle, { external_id: "x", repeats_weekly: true, day_of_week: 1, time: "09:00" });

    const patch = calls[0].args.p_patch as Record<string, unknown>;
    expect(patch).toMatchObject({ is_recurring: true, recurrence_day_of_week: 1 });
    expect(typeof patch.deadline).toBe("string");
    expect(result.content[0].text).toMatch(/every Monday/);
  });

  test("making an event one-off sends only the flag", async () => {
    const { handle, calls } = setup();
    await callTool(handle, { external_id: "x", repeats_weekly: false });
    expect(calls[0].args.p_patch).toEqual({ is_recurring: false });
  });

  test("moving to a past date still works but carries the note", async () => {
    const { handle } = setup(updated({ deadline: "2020-01-01T16:59:00+00:00" }));
    const result = await callTool(handle, { external_id: "x", date: "2020-01-01" });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toMatch(/past/i);
  });
});

test.describe("update_event: refused before the database", () => {
  const cases: [Record<string, unknown>, string][] = [
    [{ name: "x" }, "Invalid input: target"],
    [{ id: "a", external_id: "b", name: "x" }, "Invalid input: target"],
    [{ external_id: "x" }, "Invalid input: patch"],
    [{ external_id: "x", time: "09:00" }, "Invalid input: date"],
    [{ external_id: "x", day_of_week: 2 }, "Invalid input: repeats weekly"],
    [{ external_id: "x", repeats_weekly: true }, "Invalid input: day of week"],
    [{ external_id: "x", date: "2026-02-31" }, "Invalid input: date"],
    [{ external_id: "x", date: "2026-11-20", time: "25:00" }, "Invalid input: time"],
    [{ external_id: "x", date: "2026-11-20", timezone: "Mars/Phobos" }, "Invalid input: timezone"],
  ];
  for (const [args, message] of cases) {
    test(`${JSON.stringify(args)} -> ${message}`, async () => {
      const { handle, calls } = setup();
      const result = await callTool(handle, args);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe(message);
      expect(calls).toHaveLength(0);
    });
  }
});

test.describe("update_event: database answers", () => {
  test("Event not found is passed on in plain words", async () => {
    const { handle } = setup({ data: null, error: { message: "Event not found" } });
    const result = await callTool(handle, { external_id: "nope", name: "x" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Event not found");
  });

  test("an unexpected failure never carries the token or database text", async () => {
    const { handle } = setup({ data: null, error: { message: `boom ${TOKEN} at position 9` } });
    const result = await callTool(handle, { external_id: "x", name: "y" });
    const text = JSON.stringify(result);
    expect(result.isError).toBe(true);
    expect(text).not.toContain("cdt_");
    expect(text).not.toContain("boom");
  });
});
