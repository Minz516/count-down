import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { mcpEventsInterface } from "@/modules/mcpevents/mcpevents.interface";
import { AppError, ValidationError } from "@/modules/shared/errors";

// T5: the token-authenticated create path. A tiny fake client records every rpc call, so each test can say
// exactly what was sent to the database function and what happens with each kind of reply.

const TOKEN = "cdt_" + "a".repeat(64);
const NOW = new Date("2026-10-05T10:00:00Z"); // Monday 17:00 in Ho Chi Minh

interface RpcCall {
  fn: string;
  args: Record<string, unknown>;
}

type Reply = { data: unknown; error: { message: string } | null };

const CREATED_ROW = (overrides: Record<string, unknown> = {}) => ({
  action: "created",
  event: {
    id: "e1",
    external_id: null,
    name: "Passport appointment",
    deadline: "2026-11-20T16:59:00+00:00",
    description: null,
    is_recurring: false,
    recurrence_day_of_week: null,
    created_at: "2026-10-05T10:00:00+00:00",
    ...overrides,
  },
});

function fakeClient(reply: Reply | ((call: RpcCall) => Reply)) {
  const calls: RpcCall[] = [];
  const client = {
    rpc(fn: string, args: Record<string, unknown>) {
      const call = { fn, args };
      calls.push(call);
      return Promise.resolve(typeof reply === "function" ? reply(call) : reply);
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const ok = (data: unknown): Reply => ({ data, error: null });
const fail = (message: string): Reply => ({ data: null, error: { message } });

test.describe("createEvent: what is sent to the database", () => {
  test("a date alone is stored as 23:59 Ho Chi Minh time, with the token as p_token", async () => {
    const { client, calls } = fakeClient(ok(CREATED_ROW()));
    await mcpEventsInterface.createEvent(client, TOKEN, { name: "Passport appointment", date: "2026-11-20" }, NOW);

    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe("mcp_create_event");
    expect(calls[0].args).toEqual({
      p_token: TOKEN,
      p_name: "Passport appointment",
      p_deadline: "2026-11-20T16:59:00.000Z",
      p_description: null,
      p_external_id: null,
      p_is_recurring: false,
      p_recurrence_day_of_week: null,
    });
  });

  test("time, zone, description and external id are forwarded; blank description becomes null", async () => {
    const { client, calls } = fakeClient(ok(CREATED_ROW()));
    await mcpEventsInterface.createEvent(
      client,
      TOKEN,
      { name: "Dentist", date: "2026-12-01", time: "09:30", timezone: "America/New_York", description: "  bring forms  ", externalId: "vault:dentist" },
      NOW,
    );
    expect(calls[0].args).toMatchObject({
      p_deadline: "2026-12-01T14:30:00.000Z",
      p_description: "bring forms",
      p_external_id: "vault:dentist",
    });

    await mcpEventsInterface.createEvent(client, TOKEN, { name: "x", date: "2026-12-01", description: "   " }, NOW);
    expect(calls[1].args).toMatchObject({ p_description: null });
  });

  test("a weekly event is stored with the next occurrence of that LOCAL weekday", async () => {
    const { client, calls } = fakeClient(ok(CREATED_ROW({ is_recurring: true, recurrence_day_of_week: 2 })));
    await mcpEventsInterface.createEvent(client, TOKEN, { name: "Standup", repeatsWeekly: true, dayOfWeek: 2, time: "03:00" }, NOW);

    // Tuesday 03:00 in Ho Chi Minh is Monday 20:00 UTC.
    expect(calls[0].args).toMatchObject({ p_deadline: "2026-10-05T20:00:00.000Z", p_is_recurring: true, p_recurrence_day_of_week: 2 });
  });

  test("a weekly event can take its weekday from a date", async () => {
    const { client, calls } = fakeClient(ok(CREATED_ROW({ is_recurring: true, recurrence_day_of_week: 5 })));
    await mcpEventsInterface.createEvent(client, TOKEN, { name: "Friday review", repeatsWeekly: true, date: "2026-11-20" }, NOW); // a Friday
    expect(calls[0].args).toMatchObject({ p_is_recurring: true, p_recurrence_day_of_week: 5 });
  });

  test("a weekly event with neither weekday nor date is refused before any database call", async () => {
    const { client, calls } = fakeClient(ok(CREATED_ROW()));
    await expect(mcpEventsInterface.createEvent(client, TOKEN, { name: "x", repeatsWeekly: true }, NOW)).rejects.toThrow("Invalid input: day of week");
    expect(calls).toHaveLength(0);
  });

  test("a one-off event without a date is refused before any database call", async () => {
    const { client, calls } = fakeClient(ok(CREATED_ROW()));
    await expect(mcpEventsInterface.createEvent(client, TOKEN, { name: "x" }, NOW)).rejects.toThrow("Invalid input: date");
    expect(calls).toHaveLength(0);
  });

  test("bad dates, times and zones never reach the database", async () => {
    const { client, calls } = fakeClient(ok(CREATED_ROW()));
    for (const input of [
      { name: "x", date: "2026-02-31" },
      { name: "x", date: "2026-11-20", time: "25:00" },
      { name: "x", date: "2026-11-20", timezone: "Mars/Phobos" },
    ]) {
      await expect(mcpEventsInterface.createEvent(client, TOKEN, input, NOW)).rejects.toBeInstanceOf(ValidationError);
    }
    expect(calls).toHaveLength(0);
  });
});

test.describe("createEvent: what comes back", () => {
  test("created: ids, both clocks, and no note for a future date", async () => {
    const { client } = fakeClient(ok(CREATED_ROW({ external_id: "vault:p" })));
    const result = await mcpEventsInterface.createEvent(client, TOKEN, { name: "Passport appointment", date: "2026-11-20", externalId: "vault:p" }, NOW);

    expect(result).toEqual({
      action: "created",
      id: "e1",
      externalId: "vault:p",
      name: "Passport appointment",
      description: null,
      deadlineUtc: "2026-11-20T16:59:00.000Z",
      deadlineLocal: "2026-11-20 23:59",
      timezone: "Asia/Ho_Chi_Minh",
      repeatsWeekly: false,
      dayOfWeek: null,
    });
  });

  test("updated is passed through", async () => {
    const { client } = fakeClient(ok({ ...CREATED_ROW(), action: "updated" }));
    const result = await mcpEventsInterface.createEvent(client, TOKEN, { name: "x", date: "2026-11-20", externalId: "e" }, NOW);
    expect(result.action).toBe("updated");
  });

  test("a date in the past is allowed but flagged with a note", async () => {
    const { client } = fakeClient(ok(CREATED_ROW({ deadline: "2026-09-01T16:59:00+00:00" })));
    const result = await mcpEventsInterface.createEvent(client, TOKEN, { name: "x", date: "2026-09-01" }, NOW);
    expect(result.note).toMatch(/past/i);
  });

  test("the zone in the answer is the one the owner asked for", async () => {
    const { client } = fakeClient(ok(CREATED_ROW({ deadline: "2026-12-01T14:30:00+00:00" })));
    const result = await mcpEventsInterface.createEvent(client, TOKEN, { name: "x", date: "2026-12-01", time: "09:30", timezone: "America/New_York" }, NOW);
    expect(result.timezone).toBe("America/New_York");
    expect(result.deadlineLocal).toBe("2026-12-01 09:30");
  });
});

test.describe("createEvent: errors never leak the token or database internals", () => {
  const cases: [string, RegExp, string][] = [
    ["Invalid token", /^Invalid token$/, "invalid_token"],
    ["Rate limit reached", /Rate limit reached/, "rate_limited"],
    ["Too many events recently created - please wait a moment and try again", /too quickly/i, "rate_limited"],
    ["Invalid input: name", /^Invalid input: name$/, "validation_failed"],
    ["Invalid input: external_id", /^Invalid input: external_id$/, "validation_failed"],
  ];

  for (const [dbMessage, expected, code] of cases) {
    test(`"${dbMessage}" is shown as a safe message with code ${code}`, async () => {
      const { client } = fakeClient(fail(dbMessage));
      const error = await mcpEventsInterface.createEvent(client, TOKEN, { name: "x", date: "2026-11-20" }, NOW).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(code);
      expect((error as AppError).message).toMatch(expected);
    });
  }

  test("an unknown database error becomes a generic message that carries neither the token nor the original text", async () => {
    const { client } = fakeClient(fail(`permission denied for table events (token ${TOKEN}) at position 17`));
    const error = (await mcpEventsInterface.createEvent(client, TOKEN, { name: "x", date: "2026-11-20" }, NOW).catch((e: unknown) => e)) as AppError;

    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe("unexpected");
    expect(error.message).not.toContain(TOKEN);
    expect(error.message).not.toContain("permission denied");
    expect(error.message).not.toContain("cdt_");
  });
});
