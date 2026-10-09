import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { createMcpRouteHandler } from "@/lib/mcp/server";
import { mcpEventsInterface } from "@/modules/mcpevents/mcpevents.interface";

// T6: the MCP endpoint end to end, in process: HTTP request in, real protocol handling, real tool code, real
// mcpevents service, and a fake Supabase client that records the rpc calls and replies as the database would.

const TOKEN = "cdt_" + "b".repeat(64);

interface RpcCall {
  fn: string;
  args: Record<string, unknown>;
}

type Reply = { data: unknown; error: { message: string } | null };

const eventRow = (overrides: Record<string, unknown> = {}) => ({
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

function setup(reply: Reply | ((call: RpcCall) => Reply) = { data: { action: "created", event: eventRow() }, error: null }) {
  const calls: RpcCall[] = [];
  let clientsCreated = 0;
  const client = {
    rpc(fn: string, args: Record<string, unknown>) {
      const call = { fn, args };
      calls.push(call);
      return Promise.resolve(typeof reply === "function" ? reply(call) : reply);
    },
  } as unknown as SupabaseClient;
  const handle = createMcpRouteHandler({
    createClient: () => {
      clientsCreated++;
      return client;
    },
    events: mcpEventsInterface,
  });
  return { handle, calls, clients: () => clientsCreated };
}

const rpc = (method: string, params: Record<string, unknown> = {}, id = 1) => JSON.stringify({ jsonrpc: "2.0", id, method, params });

function request(body: string, headers: Record<string, string> = { authorization: `Bearer ${TOKEN}` }, method = "POST") {
  return new Request("http://localhost:3000/api/mcp", {
    method,
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
    body: method === "POST" ? body : undefined,
  });
}

/** The endpoint answers as a server-sent event or plain JSON; either way the reply is the JSON-RPC message. */
async function messageOf(response: Response): Promise<{ result?: Record<string, unknown>; error?: Record<string, unknown> }> {
  const text = await response.text();
  const data = text.split("\n").find((line) => line.startsWith("data:"));
  return JSON.parse(data ? data.slice(5).trim() : text);
}

const callTool = async (handle: (r: Request) => Promise<Response>, args: Record<string, unknown>) => {
  const response = await handle(request(rpc("tools/call", { name: "create_event", arguments: args })));
  expect(response.status).toBe(200);
  return (await messageOf(response)).result as { isError?: boolean; content: { type: string; text: string }[] };
};

test.describe("authentication at the door", () => {
  test("no Authorization header: 401, and no database client is even created", async () => {
    const { handle, calls, clients } = setup();
    const response = await handle(request(rpc("tools/list"), {}));

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toMatch(/bearer/i);
    expect(await response.json()).toEqual({ error: "Invalid token" });
    expect(clients()).toBe(0);
    expect(calls).toHaveLength(0);
  });

  test("malformed tokens: 401 without touching the database, and the token is never echoed", async () => {
    const { handle, calls, clients } = setup();
    for (const header of [
      "Bearer ",
      "Bearer wrong",
      "Bearer cdt_short",
      `Bearer cdt_${"B".repeat(64)}`, // uppercase hex is not what the database issues
      `Bearer cdt_${"b".repeat(65)}`,
      `Bearer xdt_${"b".repeat(64)}`,
      "Basic abc",
      TOKEN, // missing the "Bearer" word
    ]) {
      const response = await handle(request(rpc("tools/list"), { authorization: header }));
      expect(response.status, header).toBe(401);
      expect(await response.text(), header).not.toContain("cdt_");
    }
    expect(clients()).toBe(0);
    expect(calls).toHaveLength(0);
  });

  test("a well-formed token is passed on; whether it is valid is decided by the database", async () => {
    const { handle, calls } = setup({ data: null, error: { message: "Invalid token" } });
    const result = await callTool(handle, { name: "x", date: "2026-11-20" });

    expect(calls).toHaveLength(1);
    expect(calls[0].args.p_token).toBe(TOKEN);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Invalid token");
  });

  test("GET with a token is refused with 405 (stateless server, no streams)", async () => {
    const { handle } = setup();
    const response = await handle(request("", { authorization: `Bearer ${TOKEN}` }, "GET"));
    expect(response.status).toBe(405);
  });
});

test.describe("protocol", () => {
  test("initialize returns the server name and instructions that tell Claude the rules", async () => {
    const { handle } = setup();
    const response = await handle(
      request(rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } })),
    );
    expect(response.status).toBe(200);
    const { result } = await messageOf(response);

    expect((result?.serverInfo as { name: string }).name).toBe("countdown");
    const instructions = String(result?.instructions);
    expect(instructions).toContain("23:59");
    expect(instructions).toMatch(/external_id/);
    expect(instructions).toMatch(/absolute/i);
  });

  test("tools/list shows create_event with a schema Claude can follow", async () => {
    const { handle } = setup();
    const { result } = await messageOf(await handle(request(rpc("tools/list"))));
    const tools = result?.tools as { name: string; description: string; inputSchema: { properties: Record<string, unknown>; required?: string[] }; annotations?: Record<string, unknown> }[];

    expect(tools.map((tool) => tool.name)).toEqual(["create_event", "update_event"]);
    const tool = tools.find((t) => t.name === "create_event")!;
    expect(Object.keys(tool.inputSchema.properties).sort()).toEqual(
      ["date", "day_of_week", "description", "external_id", "name", "repeats_weekly", "time", "timezone"],
    );
    expect(tool.inputSchema.required).toEqual(["name"]);
    expect(tool.description).toMatch(/23:59/);
    expect(tool.annotations).toMatchObject({ idempotentHint: true, destructiveHint: false });
  });
});

test.describe("create_event", () => {
  test("a date alone: 23:59 Ho Chi Minh, answered with both clocks and the id", async () => {
    const { handle, calls } = setup();
    const result = await callTool(handle, { name: "Passport appointment", date: "2026-11-20" });

    expect(result.isError).toBeFalsy();
    expect(calls[0]).toEqual({
      fn: "mcp_create_event",
      args: {
        p_token: TOKEN,
        p_name: "Passport appointment",
        p_deadline: "2026-11-20T16:59:00.000Z",
        p_description: null,
        p_external_id: null,
        p_is_recurring: false,
        p_recurrence_day_of_week: null,
      },
    });
    const text = result.content[0].text;
    expect(text).toContain("Created");
    expect(text).toContain("Passport appointment");
    expect(text).toContain("2026-11-20 23:59");
    expect(text).toContain("Asia/Ho_Chi_Minh");
    expect(text).toContain("2026-11-20T16:59:00.000Z");
    expect(text).toContain("e1");
  });

  test("snake_case tool arguments reach the service: time, zone, description and external id", async () => {
    const { handle, calls } = setup({ data: { action: "created", event: eventRow({ deadline: "2026-12-01T14:30:00+00:00", external_id: "vault:dentist" }) }, error: null });
    await callTool(handle, { name: "Dentist", date: "2026-12-01", time: "09:30", timezone: "America/New_York", description: "bring forms", external_id: "vault:dentist" });

    expect(calls[0].args).toMatchObject({
      p_deadline: "2026-12-01T14:30:00.000Z",
      p_description: "bring forms",
      p_external_id: "vault:dentist",
    });
  });

  test("the same external id answers Updated", async () => {
    const { handle } = setup({ data: { action: "updated", event: eventRow({ external_id: "vault:p" }) }, error: null });
    const result = await callTool(handle, { name: "Passport appointment", date: "2026-11-20", external_id: "vault:p" });
    expect(result.content[0].text).toContain("Updated");
  });

  test("a weekly event passes repeats_weekly and day_of_week", async () => {
    const { handle, calls } = setup({ data: { action: "created", event: eventRow({ is_recurring: true, recurrence_day_of_week: 1 }) }, error: null });
    const result = await callTool(handle, { name: "Standup", repeats_weekly: true, day_of_week: 1, time: "09:00" });

    expect(calls[0].args).toMatchObject({ p_is_recurring: true, p_recurrence_day_of_week: 1 });
    expect(result.content[0].text).toMatch(/every/i);
  });

  test("a past date is created but the answer carries the note", async () => {
    const { handle } = setup({ data: { action: "created", event: eventRow({ deadline: "2020-01-01T16:59:00+00:00" }) }, error: null });
    const result = await callTool(handle, { name: "Old", date: "2020-01-01" });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toMatch(/past/i);
  });

  test("bad input is a tool error that names the field, and nothing reaches the database", async () => {
    const { handle, calls } = setup();
    for (const [args, message] of [
      [{ name: "x", date: "2026-02-31" }, "Invalid input: date"],
      [{ name: "x", date: "2026-11-20", time: "25:00" }, "Invalid input: time"],
      [{ name: "x", date: "2026-11-20", timezone: "Mars/Phobos" }, "Invalid input: timezone"],
      [{ name: "x" }, "Invalid input: date"],
      [{ name: "x", repeats_weekly: true }, "Invalid input: day of week"],
    ] as [Record<string, unknown>, string][]) {
      const result = await callTool(handle, args);
      expect(result.isError, message).toBe(true);
      expect(result.content[0].text, message).toBe(message);
    }
    expect(calls).toHaveLength(0);
  });

  test("a wrongly typed argument is rejected by the schema before any code runs", async () => {
    const { handle, calls } = setup();
    const response = await handle(request(rpc("tools/call", { name: "create_event", arguments: { name: 42, date: "2026-11-20" } })));
    const message = await messageOf(response);
    const failed = message.error !== undefined || (message.result as { isError?: boolean } | undefined)?.isError === true;
    expect(failed).toBe(true);
    expect(calls).toHaveLength(0);
  });

  test("an unexpected failure is a generic message that never contains the token or database text", async () => {
    const { handle } = setup({ data: null, error: { message: `permission denied (token ${TOKEN}) at position 3` } });
    const response = await handle(request(rpc("tools/call", { name: "create_event", arguments: { name: "x", date: "2026-11-20" } })));
    const text = await response.text();

    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain("cdt_");
    expect(text).not.toContain("permission denied");
    expect(text).toContain("Something went wrong");
  });

  test("a rate-limit reply is passed on in plain words", async () => {
    const { handle } = setup({ data: null, error: { message: "Rate limit reached" } });
    const result = await callTool(handle, { name: "x", date: "2026-11-20" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/rate limit/i);
  });
});
