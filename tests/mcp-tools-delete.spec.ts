import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { createMcpRouteHandler } from "@/lib/mcp/server";
import { mcpEventsInterface } from "@/modules/mcpevents/mcpevents.interface";

// Slice D: the delete_event tool end to end in process, with a fake Supabase client that records rpc calls.

const TOKEN = "cdt_" + "e".repeat(64);

interface RpcCall {
  fn: string;
  args: Record<string, unknown>;
}
type Reply = { data: unknown; error: { message: string } | null };

const deleted: Reply = {
  data: {
    action: "deleted",
    event: {
      id: "e1",
      external_id: "vault:dentist",
      name: "Dentist",
      deadline: "2026-11-20T16:59:00+00:00",
      description: null,
      is_recurring: false,
      recurrence_day_of_week: null,
      created_at: "2026-10-05T10:00:00+00:00",
    },
  },
  error: null,
};

function setup(reply: Reply = deleted) {
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

async function rpcCall(handle: (r: Request) => Promise<Response>, method: string, params: Record<string, unknown>) {
  const response = await handle(
    new Request("http://localhost:3000/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    }),
  );
  const text = await response.text();
  const data = text.split("\n").find((line) => line.startsWith("data:"));
  return JSON.parse(data ? data.slice(5).trim() : text);
}

const call = async (handle: (r: Request) => Promise<Response>, args: Record<string, unknown>) =>
  (await rpcCall(handle, "tools/call", { name: "delete_event", arguments: args })).result as { isError?: boolean; content: { text: string }[] };

test("confirm true deletes and the answer states what was deleted", async () => {
  const { handle, calls } = setup();
  const result = await call(handle, { external_id: "vault:dentist", confirm: true });

  expect(result.isError).toBeFalsy();
  expect(calls).toEqual([
    { fn: "mcp_delete_event", args: { p_token: TOKEN, p_id: null, p_external_id: "vault:dentist", p_confirm: true } },
  ]);
  const text = result.content[0].text;
  expect(text).toContain("Deleted");
  expect(text).toContain("Dentist");
  expect(text).toContain("2026-11-20 23:59");
  expect(text).toContain("e1");
});

test("by id", async () => {
  const { handle, calls } = setup();
  await call(handle, { id: "5b0d3f6e-1f0b-4f6e-8a52-0f7f2f7a9a11", confirm: true });
  expect(calls[0].args).toMatchObject({ p_id: "5b0d3f6e-1f0b-4f6e-8a52-0f7f2f7a9a11", p_external_id: null, p_confirm: true });
});

test("confirm missing or false is refused by the tool and never reaches the database", async () => {
  const { handle, calls } = setup();
  for (const args of [{ id: "a" }, { id: "a", confirm: false }, { external_id: "x" }]) {
    const result = await call(handle, args);
    expect(result.isError, JSON.stringify(args)).toBe(true);
    expect(result.content[0].text).toMatch(/Confirmation required/);
  }
  expect(calls).toHaveLength(0);
});

test("a non-boolean confirm is rejected by the schema", async () => {
  const { handle, calls } = setup();
  const message = await rpcCall(handle, "tools/call", { name: "delete_event", arguments: { id: "a", confirm: "true" } });
  const failed = message.error !== undefined || message.result?.isError === true;
  expect(failed).toBe(true);
  expect(calls).toHaveLength(0);
});

test("exactly one target is required", async () => {
  const { handle, calls } = setup();
  for (const args of [{ confirm: true }, { id: "a", external_id: "b", confirm: true }]) {
    const result = await call(handle, args);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Invalid input: target");
  }
  expect(calls).toHaveLength(0);
});

test("the tool is advertised as destructive and not idempotent", async () => {
  const { handle } = setup();
  const tools = (await rpcCall(handle, "tools/list", {})).result.tools as { name: string; description: string; annotations: Record<string, unknown> }[];
  const tool = tools.find((t) => t.name === "delete_event")!;
  expect(tool.annotations).toMatchObject({ destructiveHint: true, readOnlyHint: false });
  expect(tool.description).toMatch(/confirm/i);
});

test("database answers: not found, invalid token and unexpected errors are safe", async () => {
  const notFound = await call(setup({ data: null, error: { message: "Event not found" } }).handle, { id: "a", confirm: true });
  expect(notFound).toMatchObject({ isError: true });
  expect(notFound.content[0].text).toBe("Event not found");

  const bad = await call(setup({ data: null, error: { message: "Invalid token" } }).handle, { id: "a", confirm: true });
  expect(bad.content[0].text).toBe("Invalid token");

  const boom = await call(setup({ data: null, error: { message: `boom ${TOKEN}` } }).handle, { id: "a", confirm: true });
  expect(boom.isError).toBe(true);
  expect(JSON.stringify(boom)).not.toContain("cdt_");
});
