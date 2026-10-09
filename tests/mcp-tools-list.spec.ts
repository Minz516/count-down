import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { createMcpRouteHandler } from "@/lib/mcp/server";
import { mcpEventsInterface } from "@/modules/mcpevents/mcpevents.interface";

// Slice C: the list_events tool end to end in process, with a fake Supabase client that records rpc calls.

const TOKEN = "cdt_" + "d".repeat(64);

interface RpcCall {
  fn: string;
  args: Record<string, unknown>;
}
type Reply = { data: unknown; error: { message: string } | null };

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "e1",
  external_id: null,
  name: "Passport appointment",
  deadline: "2026-11-20T16:59:00+00:00",
  description: null,
  is_recurring: false,
  recurrence_day_of_week: null,
  created_at: "2026-10-05T10:00:00+00:00",
  ...overrides,
});
const listing = (events: unknown[], total = events.length): Reply => ({ data: { events, total }, error: null });

function setup(reply: Reply = listing([row()])) {
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

async function call(handle: (r: Request) => Promise<Response>, args: Record<string, unknown> = {}) {
  const response = await handle(
    new Request("http://localhost:3000/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_events", arguments: args } }),
    }),
  );
  const text = await response.text();
  const data = text.split("\n").find((line) => line.startsWith("data:"));
  return JSON.parse(data ? data.slice(5).trim() : text).result as { isError?: boolean; content: { text: string }[] };
}

test("with no arguments, everything defaults on the database side", async () => {
  const { handle, calls } = setup();
  const result = await call(handle);

  expect(result.isError).toBeFalsy();
  expect(calls).toEqual([{ fn: "mcp_list_events", args: { p_token: TOKEN, p_from: null, p_to: null, p_query: null, p_limit: null } }]);
});

test("each line has the local time, the UTC time, the id and the external_id", async () => {
  const { handle } = setup(listing([row({ external_id: "vault:p", description: "bring photos" })]));
  const text = (await call(handle)).content[0].text;

  expect(text).toContain("1 event (Asia/Ho_Chi_Minh)");
  expect(text).toContain("Passport appointment");
  expect(text).toContain("2026-11-20 23:59");
  expect(text).toContain("2026-11-20T16:59:00.000Z");
  expect(text).toContain("id: e1, external_id: vault:p");
  expect(text).toContain("bring photos");
});

test("from and to are local days: start of the first, end of the last", async () => {
  const { handle, calls } = setup();
  await call(handle, { from: "2026-11-01", to: "2026-11-30", query: " passport ", limit: 10 });

  expect(calls[0].args).toEqual({
    p_token: TOKEN,
    p_from: "2026-10-31T17:00:00.000Z", // 00:00 on 1 Nov in Ho Chi Minh
    p_to: "2026-11-30T16:59:59.999Z", // 23:59:59.999 on 30 Nov in Ho Chi Minh
    p_query: "passport",
    p_limit: 10,
  });
});

test("another time zone moves the day boundaries", async () => {
  const { handle, calls } = setup();
  await call(handle, { from: "2026-12-01", timezone: "America/New_York" });
  expect(calls[0].args.p_from).toBe("2026-12-01T05:00:00.000Z");
});

test("an empty result says so; a cut-off result says how many matched in all", async () => {
  expect((await call(setup(listing([])).handle)).content[0].text).toBe("No events found.");

  const text = (await call(setup(listing([row()], 75)).handle)).content[0].text;
  expect(text).toContain("Showing 1 of 75 events");
});

test("a weekly event reads as every weekday", async () => {
  const { handle } = setup(listing([row({ is_recurring: true, recurrence_day_of_week: 1 })]));
  expect((await call(handle)).content[0].text).toMatch(/every Monday/);
});

test("the tool is advertised as read-only", async () => {
  const { handle } = setup();
  const response = await handle(
    new Request("http://localhost:3000/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    }),
  );
  const text = await response.text();
  const data = text.split("\n").find((line) => line.startsWith("data:"));
  const tools = JSON.parse(data ? data.slice(5).trim() : text).result.tools as { name: string; annotations: Record<string, unknown> }[];
  expect(tools.find((t) => t.name === "list_events")?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
});

test("bad input is refused before the database", async () => {
  const { handle, calls } = setup();
  for (const [args, message] of [
    [{ from: "2026-02-31" }, "Invalid input: date"],
    [{ to: "garbage" }, "Invalid input: date"],
    [{ from: "2026-11-01", timezone: "Mars/Phobos" }, "Invalid input: timezone"],
  ] as [Record<string, unknown>, string][]) {
    const result = await call(handle, args);
    expect(result.isError, message).toBe(true);
    expect(result.content[0].text, message).toBe(message);
  }
  expect(calls).toHaveLength(0);
});

test("database answers: invalid token and unexpected errors are safe", async () => {
  const bad = await call(setup({ data: null, error: { message: "Invalid token" } }).handle);
  expect(bad).toMatchObject({ isError: true });
  expect(bad.content[0].text).toBe("Invalid token");

  const boom = await call(setup({ data: null, error: { message: `boom ${TOKEN}` } }).handle);
  expect(JSON.stringify(boom)).not.toContain("cdt_");
  expect(boom.isError).toBe(true);
});
